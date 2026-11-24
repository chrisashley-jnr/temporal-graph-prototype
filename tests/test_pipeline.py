import copy,io,json,math,threading,unittest,urllib.request,urllib.error
import numpy as np
import torch
from backend.data import demo,features,parse_csv,to_csv,splits,audit
from backend.evaluation import replay,view,evaluate_all,rank_metrics
from backend.models import train_all,EventTGN,SnapshotGNN,temporal_pass,snapshot_pass

def event(t=0,s='A',d='B',label=0,episode='',id='e'):
    return dict(id=id,timestamp=t,source=s,target=d,amount=100,currency='USD',label=label,episode_id=episode)

class Causality(unittest.TestCase):
    def test_labels_and_episode_ids_never_enter_features(self):
        original=demo();changed=[{**e,'label':1-e['label'],'episode_id':'different'} for e in original]
        np.testing.assert_array_equal(features(original),features(changed))
    def test_future_append_does_not_change_prior_features(self):
        events=demo();cut=500
        while events[cut-1]['timestamp']==events[cut]['timestamp']:cut+=1
        np.testing.assert_array_equal(features(events[:cut]),features(events)[:cut])
    def test_same_timestamp_is_scored_before_updates(self):
        a=event(5,'A','B',id='a');b=event(5,'A','C',id='b');prior=event(0,'D','A',id='p')
        x=features([prior,a,b]);y=features([prior,b,a]);np.testing.assert_array_equal(x[[0,1,2]],y[[0,2,1]])
        self.assertEqual(x[1,3],0);self.assertEqual(x[2,3],0)
    def test_neural_inference_prefix_and_label_independence(self):
        events=[event(i*1000,'A' if i%2 else 'B','B' if i%2 else 'A',id=str(i)) for i in range(40)]
        edges=torch.tensor([[0,1] if i%2 else [1,0] for i in range(40)])
        x=torch.tensor(features(events));labels=torch.zeros(40)
        for cls,fn in [(EventTGN,temporal_pass),(SnapshotGNN,snapshot_pass)]:
            torch.manual_seed(2);m=cls(16);m.eval()
            with torch.no_grad():
                full,_=fn(m,events,edges,x,labels,2)
                changed,_=fn(m,events,edges,x,1-labels,2)
                prefix,_=fn(m,events[:17],edges[:17],x[:17],labels[:17],2)
            np.testing.assert_array_equal(full,changed);np.testing.assert_allclose(full[:17],prefix,atol=1e-6)
    def test_tied_timestamps_stay_in_one_partition(self):
        e=[event(t,id=str(i)) for i,t in enumerate([0,60,60,80,80,100])];masks,_=splits(e)
        for t in {r['timestamp'] for r in e}:
            partitions={j for j,m in enumerate(masks) for i,v in enumerate(m) if v and e[i]['timestamp']==t}
            self.assertEqual(len(partitions),1)

class Queue(unittest.TestCase):
    def test_capacity_and_priority(self):
        e=[event(0,s=f'A{i}',id=str(i)) for i in range(5)]
        r=replay(e,[.1,.3,.8,.7,.4],0,1,0,7200)
        reviewed=[c for c in r['cases'] if c['status']=='reviewed']
        self.assertEqual([c['account'] for c in sorted(reviewed,key=lambda c:c['reviewed'])],['A2','A3'])
        self.assertEqual(r['metrics']['reviews'],2)
    def test_unused_service_slots_do_not_accumulate(self):
        r=replay([event(10000)],[1],.5,1,0,11000)
        self.assertEqual(r['cases'][0]['reviewed'],10800)
    def test_cooldown_suppresses_reopening(self):
        r=replay([event(0,id='a'),event(4000,id='b')],[1,1],.5,1,0,8000)
        self.assertEqual(len(r['cases']),1);self.assertEqual(r['metrics']['alerts'],2)
    def test_expiry_before_late_service(self):
        r=replay([event(0)],[1],.5,1,0,3600,ttl=.5)
        self.assertEqual(r['metrics']['expired'],1);self.assertEqual(r['metrics']['reviews'],0)
    def test_episode_credit_counts_once_and_respects_deadline(self):
        e=[event(0,'A','B',1,'E','a'),event(300,'C','B',1,'E','b')]
        r=replay(e,[1,1],.5,1,0,7200,deadline=2)
        self.assertEqual(r['metrics']['detected_episodes'],1)
        self.assertEqual(r['metrics']['timely_recall'],1)
        late=replay(e,[1,1],.5,.1,0,90000,deadline=2)
        self.assertEqual(late['metrics']['detected_episodes'],0)
    def test_crossing_and_right_censored_episodes_excluded(self):
        e=[event(-10,label=1,episode='cross',id='a'),event(10,label=1,episode='cross',id='b'),event(3500,label=1,episode='late',id='c')]
        r=replay(e[1:],[1,1],.5,1,0,3600,deadline=1,all_events=e)
        self.assertEqual(r['metrics']['eligible_episodes'],0);self.assertIsNone(r['metrics']['timely_recall'])
    def test_gold_labels_do_not_change_operational_decisions(self):
        e=[event(i*2000,s=f'A{i%3}',id=str(i)) for i in range(7)]
        changed=[{**v,'label':1,'episode_id':'x'} for v in e]
        def decisions(r):return [{k:v for k,v in c.items() if k!='events'} for c in r['cases']]
        self.assertEqual(decisions(replay(e,[.8]*7,.5,1,0,15000)),decisions(replay(changed,[.8]*7,.5,1,0,15000)))
    def test_ties_have_deterministic_account_order(self):
        e=[event(0,'Z','B',id='z'),event(0,'A','B',id='a')]
        a=replay(e,[1,1],.5,1,0,3600);b=replay(e[::-1],[1,1],.5,1,0,3600)
        self.assertEqual([c['account'] for c in a['cases'] if c['status']=='reviewed'],['A'])
        self.assertEqual([c['account'] for c in b['cases'] if c['status']=='reviewed'],['A'])

class DataContract(unittest.TestCase):
    def test_csv_roundtrip(self):
        original=demo();parsed=parse_csv(to_csv(original));self.assertEqual(original,parsed)
    def test_duplicate_id_rejected(self):
        e=demo();e[1]['id']=e[0]['id']
        with self.assertRaisesRegex(ValueError,'duplicate'):parse_csv(to_csv(e))
    def test_nonfinite_amount_rejected(self):
        with self.assertRaisesRegex(ValueError,'amount'):parse_csv('timestamp,source,target,amount\n2025-01-01T00:00:00Z,A,B,nan')
    def test_naive_timestamp_rejected(self):
        with self.assertRaisesRegex(ValueError,'timezone'):parse_csv('timestamp,source,target,amount\n2025-01-01T00:00:00,A,B,1')
    def test_incomplete_row_rejected(self):
        with self.assertRaisesRegex(ValueError,'missing'):parse_csv('timestamp,source,target,amount\n12,A')
    def test_milliseconds_rejected(self):
        with self.assertRaisesRegex(ValueError,'milliseconds'):parse_csv('timestamp,source,target,amount\n1761955200000,A,B,1')
    def test_mixed_currency_rejected(self):
        e=demo();e[3]['currency']='GHS'
        with self.assertRaisesRegex(ValueError,'currency'):parse_csv(to_csv(e))
    def test_labels_required_to_train(self):
        e=demo();e[1]['label']=None
        with self.assertRaisesRegex(ValueError,'label'):train_all(e)
    def test_one_class_partition_rejected(self):
        e=[{**r,'label':0,'episode_id':''} for r in demo()]
        with self.assertRaisesRegex(ValueError,'both'):train_all(e)

class FullExperiment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.events=demo();cls.pred,cls.details,_,_=train_all(cls.events,epochs=3);cls.models,cls.rate=evaluate_all(cls.events,cls.pred,cls.details)
    def test_all_four_models_execute_with_finite_scores(self):
        self.assertEqual(set(self.pred),{'history','graph','snapshot','tgn'})
        for scores in self.pred.values():self.assertEqual(len(scores),3024);self.assertTrue(np.isfinite(scores).all());self.assertTrue(all(0<=p<=1 for p in scores))
    def test_flipping_test_labels_does_not_change_fit_or_thresholds(self):
        masks,_=splits(self.events);changed=[{**e,'label':1-e['label'],'episode_id':''} if masks[2][i] else e for i,e in enumerate(self.events)]
        p,d,_,_=train_all(changed,epochs=3);m,_=evaluate_all(changed,p,d)
        for key in p:
            np.testing.assert_allclose(p[key],self.pred[key],atol=1e-7)
            self.assertEqual(m[key]['threshold'],self.models[key]['threshold'])
    def test_view_hides_gold_and_has_no_future_events(self):
        run=dict(events=self.events,predictions=self.pred,models=self.models,rate=self.rate,audit=audit(self.events))
        v=view(run,progress=.5)
        self.assertNotIn('episode_id',json.dumps(v));self.assertLess(v['transactions'],v['total_test'])
        public_events=v['network']+v['transactions_recent']+[r for c in v['cases'] for r in c['events']]
        self.assertTrue(all('label' not in r for r in public_events))
        end=run['audit']['bounds']['validation_end']+.5*(run['audit']['bounds']['end']-run['audit']['bounds']['validation_end'])
        self.assertTrue(all(e['timestamp']<=end for e in v['network']))
    def test_no_episodes_uses_validation_f1_fallback(self):
        e=[{**r,'episode_id':''} for r in self.events];m,_=evaluate_all(e,self.pred,self.details)
        for d in m.values():self.assertEqual(d['threshold_objective'],'validation_f1_fallback');self.assertIsNone(d['metrics']['timely_recall'])
    def test_metric_bounds_and_review_budget(self):
        for d in self.models.values():
            for name in ['precision','recall','f1','pr_auc','average_precision','false_positive_rate','timely_recall']:
                self.assertTrue(d['metrics'][name] is None or 0<=d['metrics'][name]<=1)
            self.assertLessEqual(d['metrics']['reviews'],3)

class LocalAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from backend.server import ThreadingHTTPServer,Handler
        try:
            cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler);cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start();cls.url=f'http://127.0.0.1:{cls.server.server_port}'
        except Exception:
            cls.server=None
    @classmethod
    def tearDownClass(cls):
        if cls.server:cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def _open(self,req):
        if not getattr(self,'server',None):self.skipTest("Server could not bind in this environment")
        try:
            return urllib.request.urlopen(req)
        except urllib.error.URLError as e:
            if isinstance(getattr(e,'reason',None),PermissionError) or 'Operation not permitted' in str(e):
                self.skipTest("Network loopback connection blocked by sandbox environment")
            raise
    def test_status_endpoint(self):
        with self._open(self.url+'/api/status') as r:self.assertEqual(r.status,200)
    def test_foreign_origin_rejected(self):
        req=urllib.request.Request(self.url+'/api/status',headers={'Origin':'https://example.com'})
        with self.assertRaises(urllib.error.HTTPError) as cm:self._open(req)
        self.assertEqual(cm.exception.code,403)
    def test_nonobject_post_rejected(self):
        req=urllib.request.Request(self.url+'/api/import',data=b'[]',headers={'Content-Type':'application/json'})
        with self.assertRaises(urllib.error.HTTPError) as cm:self._open(req)
        self.assertEqual(cm.exception.code,400)
    def test_malformed_csv_rejected_synchronously(self):
        req=urllib.request.Request(self.url+'/api/import',data=json.dumps({'csv':'timestamp,source,target,amount\n12,A'}).encode(),headers={'Content-Type':'application/json'})
        with self.assertRaises(urllib.error.HTTPError) as cm:self._open(req)
        self.assertEqual(cm.exception.code,400)

if __name__=='__main__':unittest.main()
