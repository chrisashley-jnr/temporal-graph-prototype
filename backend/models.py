"""Four executable comparison families. Neural models are compact experimental variants."""
from collections import defaultdict
from itertools import groupby
from time import perf_counter
from pathlib import Path
import json, random
import numpy as np
import torch
from torch import nn
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from .data import features, splits, HISTORY_COLUMNS
from .config import LIMITS

MODEL_NAMES={'history':'Account history','graph':'Graph features','snapshot':'Snapshot GNN','tgn':'Temporal graph network'}

class SnapshotGNN(nn.Module):
    def __init__(self,features_n,hidden=16):
        super().__init__();self.project=nn.Linear(6,hidden)
        self.message=nn.Linear(hidden*3,hidden)
        self.readout=nn.Sequential(nn.Linear(hidden*2+features_n,32),nn.ReLU(),nn.Linear(32,1))
    def forward(self,nodes,adj,edges,x):
        z=torch.relu(self.project(nodes))
        out=adj/adj.sum(1,keepdim=True).clamp_min(1)
        inc=adj.T/adj.T.sum(1,keepdim=True).clamp_min(1)
        h=torch.relu(self.message(torch.cat([z,out@z,inc@z],1)))
        return self.readout(torch.cat([h[edges[:,0]],h[edges[:,1]],x],1)).squeeze(1)

class EventTGN(nn.Module):
    def __init__(self,features_n,hidden=16):
        super().__init__();self.hidden=hidden
        self.message=nn.Sequential(nn.Linear(hidden*2+features_n,hidden),nn.Tanh())
        self.update=nn.GRUCell(hidden,hidden)
        self.readout=nn.Sequential(nn.Linear(hidden*4+features_n,32),nn.ReLU(),nn.Linear(32,1))
    def score(self,memory,neighbours,edges,x):
        s,d=edges[:,0],edges[:,1]
        def aggregate(idx):
            ids=sorted(neighbours[int(idx)])
            return memory[ids].mean(0) if ids else memory.new_zeros(self.hidden)
        ns=torch.stack([aggregate(i) for i in s]);nd=torch.stack([aggregate(i) for i in d])
        return self.readout(torch.cat([memory[s],memory[d],ns,nd,x],1)).squeeze(1)
    def advance(self,memory,edges,x):
        s,d=edges[:,0],edges[:,1]
        msg=self.message(torch.cat([memory[s],memory[d],x],1))
        reverse=self.message(torch.cat([memory[d],memory[s],x],1))
        buckets=defaultdict(list)
        for j,(a,b) in enumerate(edges.tolist()):buckets[a].append(msg[j]);buckets[b].append(reverse[j])
        ids=torch.tensor(sorted(buckets),dtype=torch.long)
        messages=torch.stack([torch.stack(buckets[i]).mean(0) for i in ids.tolist()])
        return memory.index_copy(0,ids,self.update(messages,memory[ids]))

def snapshot_pass(model,events,edges,x,labels,n,training=False,optimizer=None,criterion=None):
    adj=torch.zeros((n,n)); totals=torch.zeros((n,4)); scores=np.zeros(len(events)); losses=[]
    for _,indices in groupby(range(len(events)),key=lambda i:int(events[i]['timestamp']//21600)):
        ids=list(indices);ed=edges[ids]
        nodes=torch.cat([torch.log1p(totals),torch.log1p((adj>0).sum(1,keepdim=True)),torch.log1p((adj>0).sum(0).unsqueeze(1))],1)/10
        begin=perf_counter();pred=model(nodes,adj,ed,x[ids]);scores[ids]=torch.sigmoid(pred).detach().numpy()
        if training:
            loss=criterion(pred,labels[ids]);optimizer.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),1);optimizer.step();losses.append(loss.item())
        for i in ids:
            a,b=edges[i].tolist();adj[a,b]+=1
            totals[a,0]+=1;totals[b,1]+=1;totals[a,2]+=events[i]['amount'];totals[b,3]+=events[i]['amount']
    return scores,float(np.mean(losses)) if losses else 0

def temporal_pass(model,events,edges,x,labels,n,training=False,optimizer=None,criterion=None):
    memory=torch.zeros((n,model.hidden));neighbours=defaultdict(set);scores=np.zeros(len(events));losses=[];window=[]
    groups=[list(g) for _,g in groupby(range(len(events)),key=lambda i:events[i]['timestamp'])]
    for gi,ids in enumerate(groups):
        pred=model.score(memory,neighbours,edges[ids],x[ids]);scores[ids]=torch.sigmoid(pred).detach().numpy()
        if training:window.append(criterion(pred,labels[ids]))
        memory=model.advance(memory,edges[ids],x[ids])
        for i in ids:
            a,b=edges[i].tolist();neighbours[a].add(b);neighbours[b].add(a)
        if training and ((gi+1)%16==0 or gi==len(groups)-1):
            loss=torch.stack(window).mean();optimizer.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),1)
            optimizer.step();losses.append(loss.item());window=[];memory=memory.detach()
    return scores,float(np.mean(losses)) if losses else 0

def train_all(events,progress=lambda text:None,seed=42,epochs=3,output=None):
    random.seed(seed);np.random.seed(seed);torch.manual_seed(seed);torch.set_num_threads(1)
    masks,bounds=splits(events);train,val,test=masks
    if any(e['label'] is None for e in events):raise ValueError('Training this prototype requires a 0/1 label for every transaction. Labels remain excluded from prediction features.')
    y=np.array([e['label'] for e in events])
    for name,m in [('training',train),('validation',val)]:
        if len(np.unique(y[m]))<2:raise ValueError(f'The {name} period must contain both labelled classes.')
    progress('Building past-only transaction features')
    ft=perf_counter();raw=features(events);feature_ms=(perf_counter()-ft)*1000/len(events)
    predictions={};details={};scaler=StandardScaler().fit(raw[train]);x=torch.tensor(scaler.transform(raw),dtype=torch.float32)
    weights=np.where(y[train]==1,(1-y[train]).sum()/max(y[train].sum(),1),1)
    for key,columns in [('history',HISTORY_COLUMNS),('graph',list(range(raw.shape[1])))]:
        progress(f'Training {MODEL_NAMES[key].lower()} baseline')
        started=perf_counter();model=GradientBoostingClassifier(n_estimators=65,max_depth=2,learning_rate=.06,random_state=seed)
        model.fit(raw[train][:,columns],y[train],sample_weight=weights)
        trained=perf_counter();predictions[key]=model.predict_proba(raw[:,columns])[:,1].tolist()
        infer_ms=(perf_counter()-trained)*1000/len(events)
        details[key]={'training_seconds':round(trained-started,3),'mean_scoring_ms':infer_ms,'feature_ms':feature_ms,'seed':seed,'epochs':None,'implementation':'scikit-learn GradientBoostingClassifier','features':len(columns)}
        if output:
            import joblib
            joblib.dump(model,Path(output)/f'{key}.joblib')
    accounts=sorted({a for e in events for a in (e['source'],e['target'])});lookup={a:i for i,a in enumerate(accounts)}
    edges=torch.tensor([[lookup[e['source']],lookup[e['target']]] for e in events],dtype=torch.long)
    labels=torch.tensor(y,dtype=torch.float32);nt=int(train.sum())
    criterion=nn.BCEWithLogitsLoss(pos_weight=torch.tensor(float((1-y[train]).sum()/max(y[train].sum(),1))))
    
    omitted_models={}
    nn_pairs=[('snapshot',SnapshotGNN,snapshot_pass),('tgn',EventTGN,temporal_pass)]
    max_accts = LIMITS.get('snapshot_gnn_max_accounts', 1000)
    if len(accounts) > max_accts:
        nn_pairs=[p for p in nn_pairs if p[0]!='snapshot']
        reason = f"Dense N×N adjacency matrix requires ≤{max_accts:,} accounts (dataset has {len(accounts):,} accounts; dense N×N tensor would allocate ~{len(accounts)**2 * 4 / (1024*1024):.0f} MB per snapshot on CPU)."
        omitted_models['snapshot']={
            'name': MODEL_NAMES['snapshot'],
            'reason': reason,
            'account_limit': max_accts,
            'accounts_found': len(accounts)
        }
        progress(f"Skipping Snapshot GNN: {len(accounts):,} accounts exceeds {max_accts:,} dense matrix limit")

    for key,cls,run in nn_pairs:
        torch.manual_seed(seed);model=cls(raw.shape[1]);opt=torch.optim.Adam(model.parameters(),lr=.002)
        started=perf_counter();history=[]
        for epoch in range(epochs):
            progress(f'Training {MODEL_NAMES[key]} · epoch {epoch+1} of {epochs}')
            model.train();_,loss=run(model,events[:nt],edges[:nt],x[:nt],labels[:nt],len(accounts),True,opt,criterion);history.append(loss)
        trained=perf_counter();model.eval();progress(f'Replaying {MODEL_NAMES[key]} with frozen weights')
        with torch.no_grad():pred,_=run(model,events,edges,x,labels,len(accounts))
        predictions[key]=pred.tolist()
        details[key]={'training_seconds':round(trained-started,3),'mean_scoring_ms':(perf_counter()-trained)*1000/len(events),'feature_ms':feature_ms,'seed':seed,'epochs':epochs,'loss':history,'features':raw.shape[1],
            'implementation':'Compact directed snapshot message-passing GNN' if key=='snapshot' else 'Compact TGN variant with GRU event memory and historical-neighbour mean aggregation'}
        if output:torch.save(model.state_dict(),Path(output)/f'{key}.pt')
    if output:
        np.savez(Path(output)/'preprocessing.npz',mean=scaler.mean_,scale=scaler.scale_)
    return predictions,details,raw.tolist(),omitted_models