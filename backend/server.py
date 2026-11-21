"""Loopback-only research server. Serves the built app and the local experiment API."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from threading import Thread,Lock
from datetime import datetime,timezone
import argparse,json,os,traceback,platform
from .data import demo,parse_csv,to_csv,audit
from .models import train_all,MODEL_NAMES
from .evaluation import evaluate_all,view
from .config import LIMITS

ROOT=Path(__file__).resolve().parents[1];RUNTIME=ROOT/'runtime';RUNTIME.mkdir(exist_ok=True)
lock=Lock();state={'status':'starting','message':'Loading research workspace','error':None,'run':None}

def work(events,name,seed=42):
    try:
        def progress(message):
            with lock:state['message']=message
        report=audit(events,name); progress('Validating chronological partitions')
        predictions,details,raw,omitted_models=train_all(events,progress,seed=seed,output=RUNTIME)
        progress('Selecting thresholds on validation and evaluating held-out cases')
        models,rate=evaluate_all(events,predictions,details)
        import torch,numpy,sklearn
        run_id=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        run=dict(
            id=run_id,
            audit=report,
            events=events,
            predictions=predictions,
            models=models,
            omitted_models=omitted_models,
            rate=rate,
            created=datetime.now(timezone.utc).isoformat(),
            seed=seed,
            epochs=3,
            protocol=dict(
                split='60/20/20 by elapsed time',
                budget_per_10000=50,
                deadline_hours=24,
                cooldown_hours=6,
                queue_ttl_hours=24,
                label_use='Training loss and offline evaluation only',
                timestamp_ties='Score before group update',
                seeds_executed=1,
                scope='Exploratory prototype results; not a validated financial crime detector'
            ),
            environment=dict(
                python=platform.python_version(),
                numpy=numpy.__version__,
                torch=torch.__version__,
                sklearn=sklearn.__version__,
                device='CPU'
            )
        )
        # Atomically save active run
        temp=RUNTIME/'run.tmp.json';temp.write_text(json.dumps(run,allow_nan=False));temp.replace(RUNTIME/'run.json')
        # Preserve archived run so comparisons remain traceable
        archive=RUNTIME/f"run-{run_id}.json";archive.write_text(json.dumps(run,allow_nan=False))
        with lock:state.update(status='ready',message='Experiment ready',run=run,error=None)
    except Exception as exc:
        traceback.print_exc()
        with lock:
            prev_run=state.get('run')
            # Keep previous dataset and run active if an import or training attempt fails
            state.update(
                status='ready' if prev_run else 'error',
                message=f'Experiment failed: {exc}',
                error=str(exc)
            )

def start(events,name,seed=42):
    with lock:
        if state['status']=='training':return False
        state.update(status='training',message='Preparing dataset',error=None)
    Thread(target=work,args=(events,name,seed),daemon=True).start();return True

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
    def log_message(self,*args):pass
    def allowed(self):
        host=self.headers.get('Host','').split(':')[0]
        origin=self.headers.get('Origin')
        allowed_origins={f'http://{h}:{p}' for h in ('127.0.0.1','localhost') for p in (self.server.server_port,5173)}
        return host in ('127.0.0.1','localhost') and (not origin or origin in allowed_origins)
    def send(self,data,status=200,ctype='application/json',filename=None):
        payload=json.dumps(data,allow_nan=False).encode() if ctype=='application/json' else data.encode()
        self.send_response(status);self.send_header('Content-Type',ctype+'; charset=utf-8');self.send_header('Content-Length',str(len(payload)))
        self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
        if filename:self.send_header('Content-Disposition',f'attachment; filename="{filename}"')
        self.end_headers();self.wfile.write(payload)
    def do_GET(self):
        if not self.allowed():self.send({'error':'This prototype is restricted to localhost.'},403);return
        path=urlparse(self.path);q=parse_qs(path.query)
        with lock:current=dict(state)
        run=current.pop('run')
        try:
            if path.path=='/api/config':
                self.send({'limits':LIMITS,'model_names':MODEL_NAMES});return
            if path.path=='/api/status':
                self.send({**current,'has_run':run is not None,'audit':run['audit'] if run else None,'limits':LIMITS});return
            if path.path=='/api/demo.csv':self.send(to_csv(demo()),ctype='text/csv',filename='synthetic-transactions.csv');return
            if path.path=='/api/runs':
                # List archived runs for traceability
                runs=[]
                for p in sorted(RUNTIME.glob('run-*.json'),reverse=True)[:20]:
                    try:
                        d=json.loads(p.read_text())
                        runs.append(dict(id=d['id'],created=d.get('created'),name=d.get('audit',{}).get('name','Unknown'),seed=d.get('seed'),models=list(d.get('models',{}).keys())))
                    except Exception:pass
                self.send(runs);return
            if path.path.startswith('/api/') and not run:self.send({'error':'The first experiment is still preparing.'},409);return
            if path.path=='/api/experiment':
                self.send({k:v for k,v in run.items() if k not in ('events','predictions')});return
            if path.path=='/api/export':
                self.send({k:v for k,v in run.items() if k not in ('events','predictions')},filename='experiment-results.json');return
            if path.path=='/api/view':
                model=q.get('model',['graph'])[0];progress=float(q.get('progress',['1'])[0]);budget=float(q.get('budget',['50'])[0])
                if not 0<=progress<=1 or not 10<=budget<=1000:raise ValueError('Invalid progress or budget.')
                self.send(view(run,model,progress,budget));return
            if path.path.startswith('/api/'):
                self.send({'error':'Unknown API route.'},404);return
            if not (ROOT/'dist'/'index.html').exists():self.send({'error':'Build the frontend using npm run build, or open the Vite development URL.'},503);return
            if path.path=='/' or ('.' not in Path(path.path).name):self.path='/index.html'
            super().do_GET()
        except (ValueError,KeyError) as exc:self.send({'error':str(exc)},400)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_POST(self):
        if not self.allowed():self.send({'error':'Cross-origin requests are not allowed.'},403);return
        try:
            length=int(self.headers.get('Content-Length',0))
            if length<1 or length>LIMITS['max_file_size_bytes']:
                raise ValueError(f"Request size must be between 1 byte and {LIMITS['max_file_size_mb']} MB.")
            if not self.headers.get('Content-Type','').startswith('application/json'):raise ValueError('Send application/json.')
            data=json.loads(self.rfile.read(length))
            if not isinstance(data,dict):raise ValueError('Send a JSON object.')
            seed=int(data.get('seed',42))
            if not 0<=seed<=999999:raise ValueError('Seed must be between 0 and 999999.')
            if self.path=='/api/train':
                with lock:run=state.get('run')
                events=run['events'] if run else demo(seed);name=run['audit']['name'] if run else 'Synthetic demonstration'
            elif self.path=='/api/import':
                # Validates CSV; if fails, throws ValueError and does NOT touch current state['run']
                events=parse_csv(data.get('csv',''))
                name=str(data.get('name','Imported CSV'))[:100]
            elif self.path=='/api/reset':
                # Explicit Reset action
                events=demo(seed);name='Synthetic demonstration'
            else:self.send({'error':'Unknown API route.'},404);return
            if not start(events,name,seed):self.send({'error':'An experiment is already running.'},409);return
            self.send({'status':'training'},202)
        except (ValueError,KeyError,TypeError,json.JSONDecodeError) as exc:self.send({'error':str(exc)},400)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8766);args=parser.parse_args()
    cached=RUNTIME/'run.json'
    if cached.exists():
        try:state.update(status='ready',message='Experiment ready',run=json.loads(cached.read_text()))
        except (ValueError,KeyError):state.update(status='waiting',message='Corrupted cache. Upload a transaction file or Reset demo to begin.')
    else:state.update(status='waiting',message='Upload a transaction file to begin')
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'Temporal research prototype: http://127.0.0.1:{args.port}',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:server.server_close()

if __name__=='__main__':main()
