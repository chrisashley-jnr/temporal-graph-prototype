"""Deterministic demo data and past-only graph features. No labels enter features."""
from collections import defaultdict, deque
from datetime import datetime, timezone
from itertools import groupby
import csv, io, math, random, hashlib, json
import numpy as np
from .config import LIMITS

FEATURES = ['log_amount','hour_sin','hour_cos','sender_count_1h','sender_amount_1h',
 'sender_counterparties_1h','receiver_count_1h','receiver_amount_1h','receiver_counterparties_1h',
 'sender_idle','receiver_idle','pair_count_24h','sender_in_count_1h','sender_in_amount_1h',
 'shared_neighbours','sender_flow_ratio']
HISTORY_COLUMNS = [0,1,2,3,4,6,7,9,10,12,13]

def iso(t): return datetime.fromtimestamp(t,timezone.utc).isoformat().replace('+00:00','Z')

def make_pseudonym(raw_id: str, is_target: bool = False) -> str:
    """Consistent, collision-resistant pseudonym to protect real identifiers."""
    raw = str(raw_id).strip()
    if not raw:
        return 'UNKNOWN'
    if raw.startswith('A') and len(raw) == 5 and raw[1:].isdigit():
        return raw  # Synthetic demo account format A0000
    digest = hashlib.sha256(('temporal_pseudonym_salt_2026_' + raw).encode()).hexdigest()[:6].upper()
    if is_target or 'POS' in raw or raw.startswith('TTM-') or raw.startswith('000'):
        return f"MER-{digest}"
    return f"USR-{digest}"

def demo(seed=42):
    rng=random.Random(seed); start=1761955200; events=[]
    accounts=[f'A{i:04d}' for i in range(120)]
    def add(t,s,d,a,label=0,episode=''):
        events.append(dict(timestamp=int(t),source=s,target=d,amount=round(a,2),currency='USD',label=label,episode_id=episode))
    for day in range(14):
        base=start+day*86400
        for _ in range(165):
            s,d=rng.sample(accounts,2)
            add(base+rng.randrange(86400),s,d,min(16000,rng.lognormvariate(5.1,1.35)))
        # Recurrent benign settlement and payroll-like batches; no semantic tag is used by models.
        for batch in range(3):
            hub=rng.choice(accounts); t=base+(8+batch*4)*3600+rng.randrange(900)
            recipients=rng.sample([a for a in accounts if a!=hub],10)
            for k,a in enumerate(recipients):add(t+k*18,hub,a,rng.uniform(300,2600))
        for e in range(3):
            eid=f'E{day:02d}{e:02d}'; t=base+int((3+e*7)*3600)+rng.randrange(600)
            members=rng.sample(accounts,8); amount=rng.uniform(400,3200)
            if (day+e)%2==0:
                for k,s in enumerate(members[:5]):add(t+k*35,s,members[5],amount*rng.uniform(.8,1.2),1,eid)
                add(t+220,members[5],members[6],amount*4.7,1,eid)
                add(t+310,members[6],members[7],amount*4.55,1,eid)
            else:
                for k in range(7):add(t+k*48,members[k],members[k+1],amount*(.98**k),1,eid)
    events.sort(key=lambda e:(e['timestamp'],e['source'],e['target'],e['amount']))
    for i,e in enumerate(events): e['id']=f'TX-{i+1:06d}'
    return events

class EventList(list):
    """List with metadata annotations for audit."""
    pass

def parse_csv(text):
    if not isinstance(text,str):raise ValueError('CSV content must be text.')
    text=text.lstrip('\ufeff')
    if len(text.encode()) > LIMITS['max_file_size_bytes']:
        raise ValueError(f"CSV exceeds the {LIMITS['max_file_size_mb']} MB system limit.")
    reader=csv.DictReader(io.StringIO(text))
    raw_fields=reader.fieldnames or []
    fields={f.lstrip('\ufeff') for f in raw_fields}
    theteller='merchant_id' in fields and 'transaction_id' in fields and 'date' in fields and 'status' in fields and 'timestamp' not in fields
    required={'timestamp','source','target','amount'}
    if not theteller and not required.issubset(fields):
        raise ValueError('Required columns: timestamp, source, target, amount. Optional: currency, label, episode_id. TheTeller exports are also accepted.')
    events=[]; ids=set(); currencies=set()
    theteller_stats={'failed_messages': defaultdict(int), 'status_counts': defaultdict(int)}
    for i,row in enumerate(reader,1):
        if i > LIMITS['max_transactions']:
            raise ValueError(f"Use at most {LIMITS['max_transactions']:,} transactions in this prototype.")
        try:
            if theteller:
                status=(row.get('status') or '').strip().lower()
                msg=(row.get('message') or '').strip()
                theteller_stats['status_counts'][status]+=1
                if status=='pending':continue
                if status=='failed':
                    theteller_stats['failed_messages'][msg]+=1
                src=(row.get('source') or '').strip()
                if not src or src=='null':continue
                tgt=(row.get('merchant_id') or '').strip()
                if not tgt or tgt=='null':continue
                amt=(row.get('amount') or '').strip()
                date_raw=(row.get('date') or '').strip()
                if not amt or not date_raw:continue
                cur=(row.get('currency') or '').strip()
                if cur in ('null',''):cur='GHS'
                if 'T' not in date_raw and '+' not in date_raw and 'Z' not in date_raw:
                    date_raw=date_raw.replace(' ','T')+'+00:00'
                row={'id':(row.get('transaction_id') or '').strip(),'timestamp':date_raw,'source':src,'target':tgt,'amount':amt,'currency':cur,'label':'0' if status=='success' else '1','episode_id':''}
            if any(row.get(k) is None for k in required):raise ValueError('missing required cell')
            raw=row['timestamp'].strip()
            if raw.replace('.','',1).isdigit():t=float(raw)
            else:
                dt=datetime.fromisoformat(raw.replace('Z','+00:00'))
                if dt.tzinfo is None:raise ValueError('timestamps must include a timezone')
                t=dt.timestamp()
            amount=float(str(row['amount']).replace(',','')); raw_source=row['source'].strip(); raw_target=row['target'].strip()
            if not math.isfinite(t) or not math.isfinite(amount) or amount<=0:raise ValueError('invalid amount or time')
            if not 0<=t<=4102444800:raise ValueError('timestamps must fall between 1970 and 2100; use seconds, not milliseconds')
            if amount>1e15:raise ValueError('amount exceeds the prototype numeric limit')
            if not raw_source or not raw_target or raw_source==raw_target:raise ValueError('distinct sender and receiver required')
            if max(len(raw_source),len(raw_target)) > LIMITS['max_account_id_length']:
                raise ValueError(f"account identifier exceeds {LIMITS['max_account_id_length']} chars")
            label=None if not (row.get('label') or '').strip() else int(row['label'])
            if label not in (0,1,None):raise ValueError('label must be 0 or 1')
            eid=(row.get('episode_id') or '').strip()
            if eid and label!=1:raise ValueError('episode_id requires label=1')
            rid=(row.get('id') or '').strip() or f'TX-{i:06d}'
            if max(len(rid),len(eid)) > LIMITS['max_id_length']:
                raise ValueError(f"event or episode identifier exceeds {LIMITS['max_id_length']} chars")
            if rid in ids:
                if theteller:rid=f'{rid}-{i}'
                else:raise ValueError('duplicate transaction id')
            ids.add(rid); currency=(row.get('currency') or 'USD').strip();currencies.add(currency)
            if len(currency)>8:raise ValueError('currency code is too long')
            # Protect identifiers with consistent pseudonyms
            source=make_pseudonym(raw_source, is_target=False)
            target=make_pseudonym(raw_target, is_target=True)
            events.append(dict(id=rid,timestamp=t,source=source,target=target,amount=amount,currency=currency,label=label,episode_id=eid))
        except (ValueError,TypeError,OverflowError) as exc:raise ValueError(f'Row {i}: {exc}') from exc
    if len(events) < LIMITS['min_transactions']:
        raise ValueError(f"Provide at least {LIMITS['min_transactions']} transactions for chronological model comparison.")
    if len(currencies)>1:raise ValueError('Use a single currency or normalize amounts before importing.')
    unique_accounts = {x for e in events for x in (e['source'],e['target'])}
    if len(unique_accounts) > LIMITS['max_accounts']:
        raise ValueError(f"This system supports up to {LIMITS['max_accounts']:,} accounts (found {len(unique_accounts):,}).")
    sorted_events = EventList(sorted(events,key=lambda e:(e['timestamp'],e['id'])))
    if theteller:
        # Attach parsing metadata to events list for audit
        setattr(sorted_events, '_theteller_stats', dict(
            status_counts=dict(theteller_stats['status_counts']),
            top_failures=sorted(theteller_stats['failed_messages'].items(), key=lambda x:-x[1])[:8]
        ))
    return sorted_events

def to_csv(events):
    buf=io.StringIO(); cols=['id','timestamp','source','target','amount','currency','label','episode_id']
    w=csv.DictWriter(buf,fieldnames=cols);w.writeheader()
    for e in events:w.writerow({**{c:e.get(c,'') for c in cols},'timestamp':iso(e['timestamp'])})
    return buf.getvalue()

def features(events):
    outgoing=defaultdict(deque);incoming=defaultdict(deque);pairs=defaultdict(deque)
    neighbours=defaultdict(set);last={};matrix=[]
    for t,group in groupby(events,key=lambda e:e['timestamp']):
        group=list(group)
        for e in group:
            s,d=e['source'],e['target']; op=outgoing[s]; ip=incoming[d]; si=incoming[s]; pair=pairs[(s,d)]
            for q in (op,ip,si):
                while q and q[0][0]<t-3600:q.popleft()
            while pair and pair[0]<t-86400:pair.popleft()
            hour=t%86400/86400*2*math.pi
            out_amount=sum(v[2] for v in op);in_amount=sum(v[2] for v in si)
            matrix.append([math.log1p(e['amount']),math.sin(hour),math.cos(hour),len(op),math.log1p(out_amount),
                len({v[1] for v in op}),len(ip),math.log1p(sum(v[2] for v in ip)),len({v[1] for v in ip}),
                math.log1p(min(t-last.get(s,t-86400),86400)),math.log1p(min(t-last.get(d,t-86400),86400)),
                len(pair),len(si),math.log1p(in_amount),len(neighbours[s]&neighbours[d]),min(out_amount/(in_amount+1),20)])
        # Score the entire timestamp group before any of its edges update state.
        for e in group:
            s,d=e['source'],e['target']; outgoing[s].append((t,d,e['amount']));incoming[d].append((t,s,e['amount']))
            pairs[(s,d)].append(t);neighbours[s].add(d);neighbours[d].add(s);last[s]=last[d]=t
    return np.asarray(matrix,dtype=np.float32)

def splits(events):
    start,end=events[0]['timestamp'],events[-1]['timestamp']; span=end-start
    if span<=0:raise ValueError('Transactions need more than one timestamp.')
    a=start+.6*span; b=start+.8*span
    ts=np.asarray([e['timestamp'] for e in events]); masks=[ts<a,(ts>=a)&(ts<b),ts>=b]
    return masks, dict(start=start,train_end=a,validation_end=b,end=end)

def audit(events,name='Synthetic demonstration'):
    masks,bounds=splits(events);episodes=defaultdict(list)
    for e in events:
        if e.get('episode_id'):episodes[e['episode_id']].append(e)
    labeled=sum(e['label'] is not None for e in events)
    is_synthetic = name.startswith('Synthetic')
    tt_stats = getattr(events, '_theteller_stats', None)
    
    label_info = {
        'field': 'label' if is_synthetic else ('status' if tt_stats else 'label'),
        'type': 'synthetic_episode_marker' if is_synthetic else ('payment_failure_proxy' if tt_stats else 'user_supplied'),
        'mapping': (
            '1 = synthetic episode member, 0 = background benign'
            if is_synthetic
            else ('1 = failed/declined collection, 0 = successful payment (pending excluded)'
                  if tt_stats
                  else '1 = positive label, 0 = negative label')
        ),
        'disclaimer': (
            'Constructed demo patterns demonstrate software flow; not real-world fraud detection.'
            if is_synthetic
            else (
                'CRITICAL RESEARCH AUDIT: Positive labels (1) originate from payment gateway status "failed" '
                '(e.g., MTN collection declines, PIN timeouts, account not found, insufficient funds). '
                'These denote operational collection failures, NOT confirmed or investigated fraud. '
                'Models evaluate transaction failure predictability, not financial crime.'
                if tt_stats
                else 'Imported labels are user-supplied and have not been independently verified.'
            )
        ),
        'breakdown': tt_stats if tt_stats else None
    }
    
    warnings = []
    if is_synthetic:
        warnings.append('Constructed demo patterns are not evidence of real-world detection accuracy.')
    elif tt_stats:
        warnings.append('Payment failure proxy: 1-labels denote gateway declines/timeouts (e.g. MTN collection declined, PIN timeout), NOT confirmed fraud.')
        if len(episodes) == 0:
            warnings.append('Coordinated activity evaluation unavailable: dataset contains no independently verified incident/episode identifiers.')
    else:
        warnings.append('Imported labels and episode identities are user supplied and have not been independently verified.')
        if len(episodes) == 0:
            warnings.append('Coordinated activity evaluation unavailable: dataset contains no independently verified incident/episode identifiers.')

    return dict(
        name=name,
        transactions=len(events),
        accounts=len({a for e in events for a in (e['source'],e['target'])}),
        episodes=len(episodes),
        labelled=labeled,
        positives=sum(e['label']==1 for e in events),
        currency=events[0]['currency'],
        start=iso(events[0]['timestamp']),
        end=iso(events[-1]['timestamp']),
        checksum=hashlib.sha256(json.dumps(events,sort_keys=True).encode()).hexdigest(),
        partitions=[int(m.sum()) for m in masks],
        bounds=bounds,
        label_info=label_info,
        limits=LIMITS,
        warnings=warnings
    )
