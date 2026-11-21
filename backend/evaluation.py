"""Deterministic capacity-limited case replay and independent episode evaluation."""
from collections import defaultdict
from itertools import groupby
import math
import numpy as np
from sklearn.metrics import precision_recall_curve,average_precision_score,auc,precision_recall_fscore_support
from .data import splits,iso

def replay(events,scores,threshold,rate,start,end,deadline=24,cooldown=6,ttl=24,all_events=None):
    if not math.isfinite(rate) or rate<=0:raise ValueError('Review capacity must be positive.')
    pending={};cases=[];closed={};next_slot=start+3600/rate;counter=0;alerts=0;timeline=[]
    def expire(t):
        for account,c in list(pending.items()):
            if t-c['created']>ttl*3600:c['status']='expired';c['closed']=t;del pending[account]
    def service(t):
        nonlocal next_slot
        expire(t)
        if pending:
            c=min(pending.values(),key=lambda c:(-c['score'],c['created'],c['account']))
            c['status']='reviewed';c['reviewed']=t;closed[c['account']]=t;del pending[c['account']]
        next_slot+=3600/rate
    for t,indices in groupby(range(len(events)),key=lambda i:events[i]['timestamp']):
        if t>end:break
        while next_slot<t:service(next_slot)
        expire(t)
        for i in indices:
            e=events[i];score=float(scores[i])
            if score<threshold:continue
            alerts+=1;account=e['source']
            if t-closed.get(account,-float('inf'))<cooldown*3600:continue
            if account not in pending:
                counter+=1;c=dict(id=f'CASE-{counter:04d}',account=account,score=score,created=t,last=t,status='pending',events=[],reviewed=None)
                pending[account]=c;cases.append(c)
            c=pending[account];c['score']=max(c['score'],score);c['last']=t;c['events'].append(e)
        while next_slot<=t:service(next_slot)
        timeline.append(dict(timestamp=t,pending=len(pending),reviewed=sum(c['status']=='reviewed' for c in cases),alerts=alerts))
    while next_slot<=end:service(next_slot)
    expire(end)
    # Labels enter only below, after every operational decision is complete.
    episodes=defaultdict(list)
    for e in (all_events if all_events is not None else events):
        if e.get('episode_id'):episodes[e['episode_id']].append(e)
    eligible={k:v for k,v in episodes.items() if min(e['timestamp'] for e in v)>=start and max(e['timestamp'] for e in v)<=end and min(e['timestamp'] for e in v)+deadline*3600<=end}
    detected={};false=0;reviewed=[c for c in cases if c['status']=='reviewed'];known_reviews=0
    for c in reviewed:
        has_positive=any(e.get('label')==1 for e in c['events'])
        known=has_positive or all(e.get('label')==0 for e in c['events'])
        known_reviews+=known;false+=known and not has_positive
        for e in c['events']:
            eid=e.get('episode_id')
            if eid in eligible:
                onset=min(v['timestamp'] for v in eligible[eid]);delay=(c['reviewed']-onset)/3600
                if delay<=deadline:detected[eid]=min(detected.get(eid,float('inf')),delay)
    waits=[(c['reviewed']-c['created'])/3600 for c in reviewed]
    metrics=dict(eligible_episodes=len(eligible),detected_episodes=len(detected),
        timely_recall=len(detected)/len(eligible) if eligible else None,
        episode_status='available' if eligible else 'unavailable',
        episode_note=None if eligible else 'Unavailable — no eligible annotated episodes',
        false_reviews=int(false),false_reviews_per_1000=false/max(len(events),1)*1000,review_precision=(known_reviews-false)/known_reviews if known_reviews else None,
        reviews=len(reviewed),pending=len(pending),expired=sum(c['status']=='expired' for c in cases),alerts=alerts,
        median_wait_hours=float(np.median(waits)) if waits else None,mean_detected_delay_hours=float(np.mean(list(detected.values()))) if detected else None)
    return dict(cases=cases,metrics=metrics,timeline=timeline,detected=detected)

def rank_metrics(events,scores,threshold):
    pairs=[(e['label'],s) for e,s in zip(events,scores) if e['label'] is not None]
    if not pairs:return dict(precision=None,recall=None,f1=None,pr_auc=None,average_precision=None,false_positive_rate=None)
    y=np.array([a for a,b in pairs]);s=np.array([b for a,b in pairs]);pred=s>=threshold
    p,r,f,_=precision_recall_fscore_support(y,pred,average='binary',zero_division=0)
    pr,rc,_=precision_recall_curve(y,s)
    return dict(precision=float(p),recall=float(r),f1=float(f),pr_auc=float(auc(rc,pr)) if y.sum() else None,
        average_precision=float(average_precision_score(y,s)) if y.sum() else None,false_positive_rate=float(((y==0)&pred).sum()/(y==0).sum()) if (y==0).any() else None)

def evaluate_all(events,predictions,details,budget=50,deadline=24):
    masks,b=splits(events);val_mask=masks[1];test_mask=masks[2]
    validation=[e for e,m in zip(events,val_mask) if m];test=[e for e,m in zip(events,test_mask) if m]
    arrival=len(validation)/((b['validation_end']-b['train_end'])/3600);rate=arrival*budget/10000
    out={}
    for key,all_scores in predictions.items():
        vs=np.array(all_scores)[val_mask].tolist();ts=np.array(all_scores)[test_mask].tolist()
        candidates=sorted(set([0.0]+[float(np.quantile(vs,q)) for q in [.5,.7,.85,.9,.95,.97,.99]]))
        trials=[]
        for threshold in candidates:
            result=replay(validation,vs,threshold,rate,b['train_end'],b['validation_end'],deadline,all_events=events)
            m=result['metrics']
            objective=m['timely_recall'] if m['eligible_episodes'] else rank_metrics(validation,vs,threshold)['f1']
            trials.append((objective,-m['false_reviews'],-m['alerts'],threshold,m))
        winner=max(trials,key=lambda r:r[:4]);threshold=winner[3]
        result=replay(test,ts,threshold,rate,b['validation_end'],b['end'],deadline,all_events=events)
        out[key]=dict(threshold=threshold,threshold_objective='timely_episode_recall' if winner[4]['eligible_episodes'] else 'validation_f1_fallback',validation=winner[4],metrics={**result['metrics'],**rank_metrics(test,ts,threshold)},**details[key])
    return out,rate

def public_event(e,score=None):
    v={k:e[k] for k in ('id','timestamp','source','target','amount','currency')}
    if score is not None:v['score']=float(score)
    return v

def view(run,model='graph',progress=1,budget=50):
    if model not in run.get('models',{}):
        omitted = run.get('omitted_models',{}).get(model)
        if omitted:
            raise ValueError(f"{omitted.get('name', model)} is unavailable for this experiment. {omitted.get('reason')}")
        raise ValueError(f"Model '{model}' is unavailable for this experiment. Available models: {', '.join(run.get('models',{}).keys())}")
    events=run['events'];info=run['models'][model];scores=run['predictions'][model];bounds=run['audit']['bounds']
    begin,end=bounds['validation_end'],bounds['end'];now=begin+(end-begin)*progress
    selected=[(e,s) for e,s in zip(events,scores) if begin<=e['timestamp']<=now]
    current=[e for e,s in selected];risk=[s for e,s in selected]
    rate=run['rate']*budget/50
    result=replay(current,risk,info['threshold'],rate,begin,now,all_events=events)
    public_cases=[]
    for c in result['cases']:
        ev=c['events'];public_cases.append({**{k:v for k,v in c.items() if k!='events'},'event_count':len(ev),'total_amount':sum(e['amount'] for e in ev),
            'counterparties':len({e['target'] for e in ev}),'events':[public_event(e) for e in ev]})
    public_cases.sort(key=lambda c:(c['status']!='pending',-c['score']))
    observed_accounts={a for e in current for a in (e['source'],e['target'])}
    daily=defaultdict(lambda:dict(transactions=0,alerts=0))
    for e,s in selected:
        day=iso(e['timestamp'])[:10];daily[day]['transactions']+=1;daily[day]['alerts']+=s>=info['threshold']
    hourly=[]
    for j in range(12):
        lo=begin+(now-begin)*j/12;hi=begin+(now-begin)*(j+1)/12
        subset=[(e,s) for e,s in selected if lo<=e['timestamp']<(hi if j<11 else hi+.001)]
        hourly.append(dict(label=iso(hi)[11:16],value=len(subset),secondary=sum(s>=info['threshold'] for e,s in subset)))
    return dict(
        run_id=run.get('id'),
        model=model,
        budget_requested=budget,
        progress=progress,
        now=iso(now),
        start=iso(begin),
        end=iso(end),
        transactions=len(current),
        total_test=sum(e['timestamp']>=begin for e in events),
        accounts=len(observed_accounts),
        rate=rate,
        threshold=info['threshold'],
        cases=public_cases,
        metrics=result['metrics'],
        transactions_recent=[public_event(e,s) for e,s in selected[-80:]][::-1],
        network=[public_event(e,s) for e,s in selected[-90:]],
        series=hourly,
        daily=[dict(label=k,**v) for k,v in daily.items()],
        currency=run['audit']['currency']
    )
