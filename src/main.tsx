import React, {useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity,AlertTriangle,ArrowDownToLine,ArrowLeft,ArrowRight,Check,ChevronDown,ChevronLeft,ChevronRight,Clock3,Database,FlaskConical,GitFork,Info,Layers3,LoaderCircle,LogIn,Network,Pause,Play,RotateCcw,Search,ShieldAlert,ShieldCheck,SlidersHorizontal,Upload,X} from 'lucide-react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import {MonoRoundedLineChart} from './components/amicro/MonoRoundedLineChart';
import {MonoRoundedKpiCardChart} from './components/amicro/MonoRoundedKpiCardChart';
import {MonoRoundedDonutChart} from './components/amicro/MonoRoundedDonutChart';
import {AnimatedButton as Button} from './components/amicro/AnimatedButton';
import {useTheme} from './hooks/useTheme';
import {ThemeMorphButton} from './components/ThemeMorphButton';
import {LoginPage} from './components/rareui/LoginPage';
import './style.css';

const names:Record<string,string>={history:'Account history',graph:'Graph features',snapshot:'Snapshot GNN',tgn:'Temporal GNN'};
const pct=(n:any)=>n===null||n===undefined?'Unavailable':(n*100).toFixed(1)+'%';
const num=(n:any,d=2)=>n===null||n===undefined?'—':Number(n).toLocaleString(undefined,{maximumFractionDigits:d});
const date=(s:any)=>new Date(typeof s==='number'?s*1000:s).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
const shorten=(str:string,max=30)=>!str?'':str.length<=max?str:str.slice(0,max-12)+'…'+str.slice(-10);

async function api(path:string,options?:RequestInit){
  const r=await fetch('/api/'+path,options);
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||'The request could not be completed.');
  return data;
}

function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  badge,
  children,
  footer,
  ariaLabel
}:{
  open:boolean;
  onClose:()=>void;
  title:React.ReactNode;
  eyebrow?:string;
  badge?:React.ReactNode;
  children:React.ReactNode;
  footer?:React.ReactNode;
  ariaLabel?:string;
}){
  useEffect(()=>{
    if(!open)return;
    const handleKey=(e:KeyboardEvent)=>{
      if(e.key==='Escape')onClose();
    };
    window.addEventListener('keydown',handleKey);
    return()=>window.removeEventListener('keydown',handleKey);
  },[open,onClose]);

  if(!open)return null;

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel||(typeof title==='string'?title:'Details panel')}
      onClick={(e)=>{
        if(e.target===e.currentTarget)onClose();
      }}
    >
      <div className="drawer-panel" onClick={e=>e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-header-info">
            {eyebrow&&<p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <div className="drawer-header-actions">
            {badge}
            <button className="drawer-close-btn" aria-label="Close details" onClick={onClose}>
              <X size={16}/>
            </button>
          </div>
        </div>
        <div className="drawer-body">
          {children}
        </div>
        {footer&&(
          <div className="drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function App(){
  const {theme,setTheme,isDark}=useTheme();
  const [tab,setTab]=useState('Login');
  const [user,setUser]=useState<string|null>(null);
  const [status,setStatus]=useState<any>(null);
  const [limits,setLimits]=useState<any>({max_file_size_mb:15,max_file_size_bytes:15*1024*1024,min_transactions:100,max_transactions:25000,max_accounts:15000,snapshot_gnn_max_accounts:1000});
  const [experiment,setExperiment]=useState<any>(null);
  const [view,setView]=useState<any>(null);
  const [viewLoading,setViewLoading]=useState(false);
  const [model,setModel]=useState('graph');
  const [budget,setBudget]=useState(50);
  const [progress,setProgress]=useState(1);
  const [playing,setPlaying]=useState(false);
  const [error,setError]=useState('');
  const [connectionError,setConnectionError]=useState<string|null>(null);
  const [requesting,setRequesting]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [selectedTx,setSelectedTx]=useState<any|null>(null);
  const [selectedAccount,setSelectedAccount]=useState<string|null>(null);
  const [fromCaseId,setFromCaseId]=useState<string|null>(null);
  const [seed,setSeed]=useState(42);

  useEffect(()=>{
    const handleHash=()=>{
      if(window.location.hash==='#login')setTab('Login');
    };
    window.addEventListener('hashchange',handleHash);
    return()=>window.removeEventListener('hashchange',handleHash);
  },[]);

  const file=useRef<HTMLInputElement>(null);
  const known=useRef('');
  const activeReq=useRef<{id:number,runId:string,model:string,budget:number,progress:number}>({id:0,runId:'',model:'',budget:50,progress:1});
  const busy=requesting||status?.status==='training'||status?.status==='starting';

  // 1. Polling server status & config
  useEffect(()=>{
    let alive=true;
    const check=async()=>{
      try{
        const s=await api('status');
        if(!alive)return;
        setStatus(s);
        if(s.limits)setLimits(s.limits);
        setConnectionError(null);
        if(s.has_run&&s.status!=='training'){
          const e=await api('experiment');
          if(alive&&e.id!==known.current){
            known.current=e.id;
            setExperiment(e);
            setSelected(null);
            setSelectedTx(null);
            setSelectedAccount(null);
            setFromCaseId(null);
            setView(null);
            setProgress(1);
            setPlaying(false);
            if(!e.models[model]){
              const firstAvail=Object.keys(e.models)[0]||'graph';
              setModel(firstAvail);
            }
          }
        }
      }catch(e:any){
        if(alive)setConnectionError('Cannot reach the local research server. '+e.message);
      }
    };
    check();
    const t=setInterval(check,1800);
    return()=>{alive=false;clearInterval(t);};
  },[model]);

  // Ensure selected model is available in the experiment
  useEffect(()=>{
    if(experiment&&experiment.models&&!experiment.models[model]){
      const avail=Object.keys(experiment.models);
      if(avail.length>0&&!avail.includes(model)){
        setModel(avail[0]);
      }
    }
  },[experiment,model]);

  // 2. Prevent stale results on model / parameter changes
  useEffect(()=>{
    if(!experiment||!experiment.models[model])return;
    setView(null);
    setViewLoading(true);
    const reqId=++activeReq.current.id;
    activeReq.current={id:reqId,runId:experiment.id,model,budget,progress};

    const c=new AbortController();
    api(`view?model=${model}&progress=${progress}&budget=${budget}`,{signal:c.signal})
      .then(data=>{
        if(activeReq.current.id===reqId&&
           activeReq.current.runId===experiment.id&&
           activeReq.current.model===data.model&&
           activeReq.current.budget===data.budget_requested&&
           Math.abs(activeReq.current.progress-data.progress)<0.01){
          setView(data);
          setViewLoading(false);
          setError('');
        }
      })
      .catch(e=>{
        if(e.name!=='AbortError'&&activeReq.current.id===reqId){
          setView(null);
          setViewLoading(false);
          setError(e.message);
        }
      });
    return()=>c.abort();
  },[experiment?.id,model,progress,budget]);

  useEffect(()=>{if(!playing)return;const t=setInterval(()=>setProgress(p=>Math.min(1,p+.025)),650);return()=>clearInterval(t);},[playing]);
  useEffect(()=>{if(progress>=1)setPlaying(false);},[progress]);

  async function action(endpoint:string,data:any){
    setError('');
    setRequesting(true);
    setPlaying(false);
    try{
      await api(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,seed})});
      setStatus((s:any)=>({...s,status:'training',message:'Preparing experiment'}));
    }catch(e:any){
      setError(e.message);
    }finally{
      setRequesting(false);
    }
  }

  async function upload(f:File|undefined){
    if(!f)return;
    const maxBytes=limits.max_file_size_bytes||15*1024*1024;
    const maxMb=limits.max_file_size_mb||15;
    if(f.size>maxBytes){
      setError(`File size (${(f.size/1024/1024).toFixed(1)} MB) exceeds the ${maxMb} MB system limit.`);
      return;
    }
    await action('import',{csv:await f.text(),name:f.name});
    if(file.current)file.current.value='';
  }

  const chosen=view?.cases.find((c:any)=>c.id===selected);
  const m=view?.metrics;
  const isFailureProxy=experiment?.audit?.label_info?.type==='payment_failure_proxy';
  const isSynthetic=experiment?.audit?.name==='Synthetic demonstration';

  if (tab === 'Login') {
    return (
      <LoginPage
        theme={theme}
        onToggleTheme={setTheme}
        onSuccess={(email) => {
          setUser(email);
          setTab('Overview');
          if (typeof window !== 'undefined' && window.location.hash === '#login') {
            window.history.replaceState(null, '', ' ');
          }
        }}
        onBackToLab={() => {
          setTab('Overview');
          if (typeof window !== 'undefined' && window.location.hash === '#login') {
            window.history.replaceState(null, '', ' ');
          }
        }}
      />
    );
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('Overview');}} aria-label="Temporal overview">
        <img src="/TemporalLogo.svg" alt="Temporal" className="temporal-logo" style={{height:28,maxHeight:32,width:'auto',objectFit:'contain',display:'block'}}/>
        <span className="lab-badge">RESEARCH LAB</span>
      </a>
      <div className="topbar-right">
        <nav aria-label="Main navigation">
          {['Overview','Cases','Experiments','Dataset'].map(t=>(
            <button key={t} aria-current={tab===t?'page':undefined} className={tab===t?'current':''} onClick={()=>setTab(t)}>{t}</button>
          ))}
        </nav>
        {user ? (
          <button
            className="user-badge-btn"
            onClick={() => {
              setUser(null);
              setTab('Login');
            }}
            title={`Signed in as ${user} · Click to sign out`}
          >
            <ShieldCheck size={13} style={{ color: '#10b981' }} />
            <span>{user.split('@')[0]}</span>
            <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 2 }}>Sign out</span>
          </button>
        ) : (
          <button
            className="login-nav-btn"
            onClick={() => setTab('Login')}
            title="Sign in with Rare UI Auth"
          >
            <LogIn size={13} />
            <span>Sign in</span>
          </button>
        )}
        <ThemeMorphButton theme={theme} onToggle={setTheme}/>
      </div>
    </header>

    <main>
      <div className="page-heading">
        <h1>{tab}</h1>
        <div className="heading-actions">
          <span className="badge dataset-badge" title={experiment?.audit?.name||'No dataset'}>
            <Database size={12}/>{isSynthetic?'Synthetic demo':'Local dataset'}
          </span>
          <Button icon={Upload} onClick={()=>file.current?.click()} disabled={busy}>Import CSV</Button>
          <Button icon={busy?LoaderCircle:FlaskConical} primary onClick={()=>action('train',{})} disabled={busy}>
            {busy?'Training…':'Run experiment'}
          </Button>
        </div>
      </div>

      <input ref={file} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Import transaction CSV" onChange={e=>upload(e.target.files?.[0])}/>

      {connectionError&&(
        <div role="alert" className="notice danger-badge" style={{marginBottom:14}}>
          <AlertTriangle size={16}/><span>{connectionError}</span>
        </div>
      )}
      {(error||status?.error)&&(
        <div role="alert" className="notice">
          <Info size={16}/><span>{error||status.error}</span>
          <button aria-label="Dismiss error" onClick={()=>{setError('');setStatus((s:any)=>({...s,error:null}));}}><X size={16}/></button>
        </div>
      )}

      {busy&&(
        <div role="status" className="notice">
          <LoaderCircle size={16} className="spin"/>
          <span>{status?.message||'Preparing experiment'}{experiment?' · Active completed run remains available.':''}</span>
        </div>
      )}

      {!experiment?(
        <div className="loading-state">
          <LoaderCircle size={27} className="spin"/>
          <h2>{status?.status==='waiting'?'Workspace ready for data':'Loading research workspace'}</h2>
          <p>{status?.message||'Upload a transaction CSV or run the demo to begin.'}</p>
          {status?.status==='waiting'&&<Button icon={RotateCcw} onClick={()=>action('reset',{})} disabled={busy}>Load synthetic demo</Button>}
        </div>
      ):(
        <>
          <div className="active-run-banner">
            <div className="run-identity-item">
              <span className="run-identity-label">Dataset:</span>
              <span className="run-identity-value" title={experiment.audit.name}>
                <Database size={13}/>
                {shorten(experiment.audit.name, 36)}
              </span>
            </div>
            <div className="run-identity-item">
              <span className="run-identity-label">Run:</span>
              <span className="run-identity-value mono">
                <Clock3 size={13}/>
                {experiment.id} · {date(experiment.created)} UTC
              </span>
            </div>
            <div className="run-identity-item">
              <span className="run-identity-label">Model:</span>
              <span className="run-identity-value">
                <Layers3 size={13}/>
                {names[model]||model}
              </span>
            </div>
            {isFailureProxy&&(
              <span className="badge warning-badge" title="Original column 'status'. Denotes telco payment collection declines (MTN declines, PIN timeouts), not confirmed fraud.">
                <ShieldAlert size={12}/> Payment Failure Proxy
              </span>
            )}
            {isSynthetic&&(
              <span className="badge"><FlaskConical size={12}/> Synthetic Demo</span>
            )}
          </div>

          {(tab==='Overview'||tab==='Cases')&&(
            <section className="replay-bar" aria-label="Replay controls">
              <div className="replay-label">
                <span className={playing?'status-dot pulse':'status-dot'}/>
                <strong>Test-window replay</strong>
                <span>{view?date(view.now):'—'} UTC</span>
              </div>
              <div className="replay-controls">
                <button className="icon-button" title="Reset replay" aria-label="Reset replay" onClick={()=>{setProgress(0);setPlaying(false);setSelected(null);setSelectedTx(null);setSelectedAccount(null);}}>
                  <RotateCcw size={15}/>
                </button>
                <button className="play-button" aria-label={playing?'Pause replay':'Play replay'} onClick={()=>{if(progress>=1)setProgress(0);setPlaying(!playing);}}>
                  {playing?<Pause size={13}/>:<Play size={13}/>}
                </button>
                <input type="range" min="0" max="100" value={Math.round(progress*100)} onChange={e=>{setPlaying(false);setProgress(Number(e.target.value)/100);}} aria-label="Replay progress"/>
                <span className="mono progress-value">{Math.round(progress*100)}%</span>
              </div>

              <label className="select-wrap" title="Detection Model">
                <Layers3 size={14}/>
                <select aria-label="Detection model" value={model} onChange={e=>{setModel(e.target.value);setSelected(null);setSelectedTx(null);setSelectedAccount(null);}}>
                  {Object.entries(names).map(([k,v])=>{
                    const isAvail=Boolean(experiment.models && experiment.models[k]);
                    const omitReason=experiment.omitted_models?.[k]?.reason;
                    return (
                      <option value={k} key={k} disabled={!isAvail} title={!isAvail?(omitReason||'Unavailable for this dataset'):undefined}>
                        {v}{!isAvail?' (Unavailable — >1k accounts)':''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={12}/>
              </label>

              <label className="select-wrap budget" title="Review Capacity Budget">
                <SlidersHorizontal size={14}/>
                <select aria-label="Review budget" value={budget} onChange={e=>setBudget(Number(e.target.value))}>
                  {[50,100,500,1000].map(n=><option key={n} value={n}>{n} reviews / 10k</option>)}
                </select>
                <ChevronDown size={12}/>
              </label>
            </section>
          )}

          {viewLoading||!view?(
            <div className="view-loading-panel">
              <LoaderCircle size={24} className="spin"/>
              <p>Evaluating {names[model]||model} with frozen validation threshold…</p>
            </div>
          ):(
            <>
              {tab==='Overview'&&(
                <>
                  <div className="kpi-grid">
                    <MonoRoundedKpiCardChart theme={theme} title="Transactions observed" value={num(view.transactions,0)} note={`${num(view.total_test,0)} in held-out test window`} icon={Activity} data={view.daily.map((d:any)=>({period:d.label,val:d.transactions}))}/>
                    <MonoRoundedKpiCardChart theme={theme} title="Connected accounts" value={num(view.accounts,0)} note="Pseudonymized senders and merchants" icon={Network}/>
                    <MonoRoundedKpiCardChart theme={theme} title="Awaiting review" value={num(m.pending,0)} note={`${m.reviews} reviewed · ${m.expired} expired`} icon={Layers3}/>
                    <MonoRoundedKpiCardChart
                      theme={theme}
                      title="Timely episode recall"
                      value={m.eligible_episodes>0?pct(m.timely_recall):'Unavailable'}
                      note={m.eligible_episodes>0?`${m.detected_episodes} of ${m.eligible_episodes} eligible episodes · ≤24h`:'No eligible annotated incident episodes'}
                      icon={ShieldCheck}
                    />
                  </div>

                  <div className="charts-grid">
                    <MonoRoundedLineChart theme={theme} data={view.series} total={view.transactions}/>
                    <MonoRoundedDonutChart theme={theme} data={[{name:'Pending',value:m.pending},{name:'Reviewed',value:m.reviews},{name:'Expired',value:m.expired}]}/>
                  </div>

                  <div className="investigation-grid">
                    <GraphPanel isDark={isDark} edges={view.network} chosen={chosen} threshold={view.threshold} onInspectAccount={setSelectedAccount} onInspectCase={setSelected}/>
                    <section className="panel queue-preview">
                      <div className="section-heading">
                        <div><p className="eyebrow">Review workspace</p><h2>Account cases <span>{view.cases.length}</span></h2></div>
                        <button className="text-button" onClick={()=>setTab('Cases')}>View all <ArrowRight size={14}/></button>
                      </div>
                      {view.cases.slice(0,4).map((c:any)=>(
                        <button key={c.id} className={`case-preview ${selected===c.id?'selected':''}`} onClick={()=>setSelected(c.id)}>
                          <span className="account-icon"><GitFork size={17}/></span>
                          <span><strong>{c.account}</strong><small>{c.id} · {c.event_count} flagged events</small></span>
                          <span className="case-end"><b>{c.score.toFixed(3)}</b><small>{c.status}</small></span>
                          <ChevronRight size={15}/>
                        </button>
                      ))}
                      {view.cases.length===0&&<Empty text="No cases at this point in the replay."/>}
                    </section>
                  </div>

                  <TransactionTable events={view.transactions_recent.slice(0,8)} threshold={view.threshold} currency={view.currency} onSelectTx={setSelectedTx}/>
                </>
              )}

              {tab==='Cases'&&(
                <>
                  <div className="metric-strip">
                    <span><b>{m.pending}</b> pending</span>
                    <span><b>{m.reviews}</b> reviewed</span>
                    <span><b>{num(view.rate,3)}</b> reviews/hour</span>
                    <span><b>{num(m.median_wait_hours)}</b> median wait (hours)</span>
                    <span><b>{num(m.false_reviews_per_1000)}</b> false reviews / 1k</span>
                  </div>
                  <Cases cases={view.cases} onSelect={setSelected} selected={selected}/>
                  <div style={{marginBottom:20}}>
                    <GraphPanel isDark={isDark} edges={view.network} chosen={chosen} threshold={view.threshold} onInspectAccount={setSelectedAccount} onInspectCase={setSelected}/>
                  </div>
                </>
              )}

              {tab==='Experiments'&&(
                <Experiments experiment={experiment} seed={seed} setSeed={setSeed} busy={busy} onRun={()=>action('train',{})}/>
              )}

              {tab==='Dataset'&&(
                <Dataset experiment={experiment} limits={limits} onImport={()=>file.current?.click()} onReset={()=>action('reset',{})} busy={busy}/>
              )}

              <div className="research-note">
                <Info size={15}/>
                <p>
                  {isSynthetic
                    ? 'Constructed synthetic data for software testing. Results do not represent real-world fraud detection.'
                    : isFailureProxy
                    ? 'CRITICAL RESEARCH AUDIT: The 2,097 positive labels in this dataset originate from payment gateway status "failed" (MTN collection declines, PIN timeouts, account-not-found). These measure operational payment failure predictability, NOT confirmed fraud.'
                    : 'Imported local transaction dataset. Coordinated-incident detection requires independently validated episode ground-truth.'}
                  {' '}Identifiers are consistently pseudonymized.
                </p>
              </div>
            </>
          )}

          {/* Off-canvas Overlay: Case Details */}
          {chosen&&(
            <Drawer
              open={Boolean(chosen)}
              onClose={()=>setSelected(null)}
              eyebrow="Case investigation"
              title={chosen.id}
              badge={<span className={`status-tag ${chosen.status}`}>{chosen.status}</span>}
              footer={
                <>
                  <button
                    className="text-button"
                    onClick={()=>{
                      setSelectedAccount(chosen.account);
                    }}
                  >
                    <Network size={14}/> Inspect account {chosen.account}
                  </button>
                  <Button onClick={()=>setSelected(null)}>Close</Button>
                </>
              }
            >
              <div className="drawer-stat-grid">
                <div className="drawer-stat-card">
                  <span className="drawer-stat-label">Model Risk Score</span>
                  <span className="drawer-stat-value mono">{chosen.score.toFixed(4)}</span>
                </div>
                <div className="drawer-stat-card">
                  <span className="drawer-stat-label">Flagged Volume</span>
                  <span className="drawer-stat-value">{num(chosen.total_amount)} {view?.currency}</span>
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-section-title">Case Metadata</span>
                <dl className="details-list">
                  <div><dt>Account (Pseudonym)</dt><dd className="mono">{chosen.account}</dd></div>
                  <div><dt>Unique Counterparties</dt><dd>{chosen.counterparties}</dd></div>
                  <div><dt>First Flagged</dt><dd>{date(chosen.created)} UTC</dd></div>
                  <div><dt>Reviewed Time</dt><dd>{chosen.reviewed?date(chosen.reviewed)+' UTC':'Pending simulated review'}</dd></div>
                  <div><dt>Priority Queue Rank</dt><dd>Capacity-limited chronological order</dd></div>
                </dl>
              </div>

              <div className="drawer-section">
                <span className="drawer-section-title">
                  <span>Observed Evidence</span>
                  <span className="badge">{chosen.events.length} flagged events</span>
                </span>
                <div className="drawer-section" style={{gap:8}}>
                  {chosen.events.map((e:any)=>(
                    <div
                      key={e.id}
                      className="drawer-evidence-item"
                      onClick={()=>{
                        setFromCaseId(chosen.id);
                        setSelected(null);
                        setSelectedTx(e);
                      }}
                      title="Click to inspect transaction details"
                    >
                      <div className="drawer-evidence-top">
                        <span>{e.source} <ArrowRight size={11}/> {e.target}</span>
                        <b>{num(e.amount)} {view?.currency}</b>
                      </div>
                      <div className="drawer-evidence-bottom">
                        <span className="mono">{e.id}</span>
                        <span>{date(e.timestamp)} UTC · Score {e.score?e.score.toFixed(3):chosen.score.toFixed(3)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="panel-footnote">
                Observed associations are evidence for review, not a finding of fraud. Identifiers are pseudonymized.
              </p>
            </Drawer>
          )}

          {/* Off-canvas Overlay: Transaction Details */}
          {selectedTx&&(
            <Drawer
              open={Boolean(selectedTx)}
              onClose={()=>{setSelectedTx(null);setFromCaseId(null);}}
              eyebrow="Transaction evidence"
              title={selectedTx.id}
              badge={
                <span className={`status-tag ${view&&selectedTx.score>=view.threshold?'pending':''}`}>
                  {view&&selectedTx.score>=view.threshold?'Flagged':'Below threshold'}
                </span>
              }
              footer={
                <>
                  {fromCaseId?(
                    <button
                      className="text-button"
                      onClick={()=>{
                        const cid=fromCaseId;
                        setFromCaseId(null);
                        setSelectedTx(null);
                        setSelected(cid);
                      }}
                    >
                      <ArrowLeft size={14}/> Back to Case {fromCaseId}
                    </button>
                  ):(
                    <span className="muted-text mono" style={{fontSize:11}}>Score: {selectedTx.score!==undefined?selectedTx.score.toFixed(4):'—'}</span>
                  )}
                  <Button onClick={()=>{setSelectedTx(null);setFromCaseId(null);}}>Close</Button>
                </>
              }
            >
              <div className="drawer-stat-grid">
                <div className="drawer-stat-card">
                  <span className="drawer-stat-label">Transaction Amount</span>
                  <span className="drawer-stat-value">{num(selectedTx.amount)} {selectedTx.currency||view?.currency}</span>
                </div>
                <div className="drawer-stat-card">
                  <span className="drawer-stat-label">Model Risk Score</span>
                  <span className="drawer-stat-value mono">{selectedTx.score!==undefined?selectedTx.score.toFixed(4):'—'}</span>
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-section-title">Transfer Route &amp; Signal</span>
                <dl className="details-list">
                  <div><dt>Origin (Sender)</dt><dd className="mono">{selectedTx.source}</dd></div>
                  <div><dt>Destination (Recipient)</dt><dd className="mono">{selectedTx.target}</dd></div>
                  <div><dt>Timestamp</dt><dd>{date(selectedTx.timestamp)} UTC</dd></div>
                  <div><dt>Decision Threshold</dt><dd className="mono">{view?view.threshold.toFixed(4):'—'}</dd></div>
                  <div><dt>Signal</dt><dd>{view&&selectedTx.score>=view.threshold?'Suspicious (Exceeds threshold)':'Normal (Below threshold)'}</dd></div>
                </dl>
              </div>

              {view?.cases.some((c:any)=>c.events.some((ev:any)=>ev.id===selectedTx.id))&&(
                <div className="drawer-section">
                  <span className="drawer-section-title">Associated Case</span>
                  {view.cases.filter((c:any)=>c.events.some((ev:any)=>ev.id===selectedTx.id)).map((c:any)=>(
                    <button
                      key={c.id}
                      className="case-preview drawer-case-card"
                      onClick={()=>{
                        setSelectedTx(null);
                        setFromCaseId(null);
                        setSelected(c.id);
                      }}
                    >
                      <span className="account-icon"><GitFork size={15}/></span>
                      <span><strong>{c.id}</strong><small>{c.account} · Score {c.score.toFixed(3)}</small></span>
                      <span className="case-end"><span className={`status-tag ${c.status}`}>{c.status}</span></span>
                      <ChevronRight size={14}/>
                    </button>
                  ))}
                </div>
              )}

              <p className="panel-footnote">
                Individual transactions reflect observed payments at replay time. Identifiers are pseudonymized.
              </p>
            </Drawer>
          )}

          {/* Off-canvas Overlay: Account Overview */}
          {selectedAccount&&(
            <Drawer
              open={Boolean(selectedAccount)}
              onClose={()=>setSelectedAccount(null)}
              eyebrow="Account overview"
              title={selectedAccount}
              badge={<span className="badge">Pseudonym Account</span>}
              footer={<Button onClick={()=>setSelectedAccount(null)}>Close</Button>}
            >
              {(()=>{
                const accEvents = (view?.network||[]).filter((e:any)=>e.source===selectedAccount||e.target===selectedAccount);
                const accCases = (view?.cases||[]).filter((c:any)=>c.account===selectedAccount);
                const totalVol = accEvents.reduce((s:number,e:any)=>s+Number(e.amount||0),0);
                return (
                  <>
                    <div className="drawer-stat-grid">
                      <div className="drawer-stat-card">
                        <span className="drawer-stat-label">Observed Volume</span>
                        <span className="drawer-stat-value">{num(totalVol)} {view?.currency}</span>
                      </div>
                      <div className="drawer-stat-card">
                        <span className="drawer-stat-label">Recent Activity</span>
                        <span className="drawer-stat-value">{accEvents.length} events</span>
                      </div>
                    </div>

                    <div className="drawer-section">
                      <span className="drawer-section-title">Associated Cases ({accCases.length})</span>
                      {accCases.length>0?(
                        accCases.map((c:any)=>(
                          <button
                            key={c.id}
                            className="case-preview drawer-case-card"
                            onClick={()=>{
                              setSelectedAccount(null);
                              setSelected(c.id);
                            }}
                          >
                            <span className="account-icon"><GitFork size={15}/></span>
                            <span><strong>{c.id}</strong><small>{c.event_count} flagged events</small></span>
                            <span className="case-end"><b>{c.score.toFixed(3)}</b><small>{c.status}</small></span>
                            <ChevronRight size={14}/>
                          </button>
                        ))
                      ):(
                        <p className="muted-text" style={{fontSize:11}}>No active investigation cases for this account.</p>
                      )}
                    </div>

                    <div className="drawer-section">
                      <span className="drawer-section-title">Direct Connections ({accEvents.length})</span>
                      <div className="drawer-section" style={{gap:6}}>
                        {accEvents.slice(0,10).map((e:any)=>(
                          <div
                            key={e.id}
                            className="drawer-evidence-item"
                            onClick={()=>{
                              setSelectedAccount(null);
                              setSelectedTx(e);
                            }}
                          >
                            <div className="drawer-evidence-top">
                              <span>{e.source} <ArrowRight size={11}/> {e.target}</span>
                              <b>{num(e.amount)} {view?.currency}</b>
                            </div>
                            <div className="drawer-evidence-bottom">
                              <span className="mono">{e.id}</span>
                              <span>{date(e.timestamp)} UTC</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </Drawer>
          )}
        </>
      )}
    </main>

    <footer>
      <span className="footer-brand">
        <img src="/TemporalLogo.svg" alt="Temporal" className="footer-logo" style={{height:16,maxHeight:18,width:'auto',objectFit:'contain',verticalAlign:'middle'}}/>
        <span className="lab-badge" style={{paddingLeft:10,marginLeft:0,borderLeft:'1px solid #333'}}>RESEARCH LAB</span>
        <span className="muted-text">/</span>
        <span>Prototype v0.2</span>
      </span>
      <span>Local processing · UTC</span>
    </footer>
  </div>;
}

function Empty({text}:{text:string}){return <div className="empty-state"><Layers3 size={22}/><p>{text}</p></div>;}

function GraphPanel({edges,chosen,threshold,onInspectAccount,onInspectCase,isDark=true}:{edges:any[],chosen:any,threshold:number,onInspectAccount?:(acc:string)=>void,onInspectCase?:(id:string)=>void,isDark?:boolean}){
  const [focus,setFocus]=useState<string|null>(null);
  useEffect(()=>setFocus(chosen?.account||null),[chosen?.id]);
  const combined=useMemo(()=>{
    const d=new Map(edges.map(e=>[e.id,e]));
    for(const e of chosen?.events||[])d.set(e.id,{...e,score:chosen.score});
    return [...d.values()];
  },[edges,chosen]);
  const counts=new Map<string,number>();
  combined.forEach(e=>{counts.set(e.source,(counts.get(e.source)||0)+1);counts.set(e.target,(counts.get(e.target)||0)+1);});
  const center=focus||(chosen?.account)||[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0];
  const connections=combined.filter(e=>e.source===center||e.target===center);
  const neighbours=[...new Set(connections.flatMap(e=>[e.source,e.target]))].filter(n=>n!==center).slice(0,12);
  const nodes=[center,...neighbours].filter(Boolean);
  const positions=new Map<string,{x:number,y:number}>(nodes.map((n,i)=>[n,i===0?{x:290,y:121}:{x:290+210*Math.cos((i-1)/Math.max(neighbours.length,1)*2*Math.PI),y:121+82*Math.sin((i-1)/Math.max(neighbours.length,1)*2*Math.PI)}]));
  const graphEdges=combined.filter(e=>positions.has(e.source)&&positions.has(e.target));

  return <section className="panel graph-panel">
    <div className="section-heading">
      <div><p className="eyebrow">Temporal neighbourhood</p><h2>Connections in motion</h2></div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        {center&&onInspectAccount&&(
          <button className="text-button" onClick={()=>onInspectAccount(center)}>
            Inspect {center} <ArrowRight size={12}/>
          </button>
        )}
        <span className="badge"><span className="status-dot"/>{nodes.length} accounts shown</span>
      </div>
    </div>
    <div className="graph-stage">
      {nodes.length?(
        <svg viewBox="0 0 580 255" role="img" aria-label={`Observed transaction neighbourhood for ${center}`}>
          <defs>
            <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill={isDark?'#444':'#cbd5e1'}/></pattern>
            <marker id="arrow" viewBox="0 0 8 8" refX="19" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8" fill={isDark?'#999':'#64748b'}/></marker>
          </defs>
          <rect width="580" height="255" fill="url(#dots)"/>
          {graphEdges.map(e=>{
            const a=positions.get(e.source)!,b=positions.get(e.target)!;
            const isFlagged=e.score>=threshold;
            const strokeColor=isFlagged?(isDark?'#b6b6bd':'#18181b'):(isDark?'#48484f':'#cbd5e1');
            return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={strokeColor} strokeWidth={isFlagged?1.5:1} strokeDasharray={isFlagged?undefined:'3 4'} markerEnd="url(#arrow)">
              <title>{e.source} → {e.target} · {num(e.amount)} {e.currency}</title>
            </line>;
          })}
          {nodes.map((n,i)=>{
            const p=positions.get(n)!;
            const isCenter=i===0;
            const circleFill=isCenter?(isDark?'#ededed':'#18181b'):(isDark?'#1e1e20':'#ffffff');
            const circleStroke=isCenter?(isDark?'#fff':'#09090b'):(isDark?'#616167':'#cbd5e1');
            const textFill=isCenter?(isDark?'#161616':'#ffffff'):(isDark?'#ddd':'#18181b');
            const subTextFill=isDark?'#a1a1aa':'#64748b';
            return <g key={n} role="button" tabIndex={0} aria-label={`Focus account ${n}`} onClick={()=>setFocus(n)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFocus(n);}}} className="graph-node">
              <circle cx={p.x} cy={p.y} r={isCenter?26:16} fill={circleFill} stroke={circleStroke} strokeWidth={1}/>
              {isCenter&&<circle cx={p.x} cy={p.y} r={32} fill="none" stroke={isDark?'#444':'#94a3b8'} strokeDasharray="3 4"/>}
              <text x={p.x} y={p.y+4} textAnchor="middle" fontSize={isCenter?11:9} fontWeight={isCenter?600:500} fill={textFill}>{n.slice(-4)}</text>
              <text x={p.x} y={p.y+(isCenter?48:33)} textAnchor="middle" fontSize="10" fill={subTextFill}>{n}</text>
            </g>;
          })}
        </svg>
      ):<Empty text="Start the replay to build the graph."/>}
    </div>
    <div className="chart-caption">
      <span><i className="legend-dot"/>Flagged edge</span>
      <span><i className="legend-dot muted"/>Other observed edge</span>
      <span className="push">Click a node to focus · Pseudonymized identifiers</span>
    </div>
    <p className="panel-footnote">Latest 90 events + selected case. Up to 12 neighbours; this view is a sample, not the full graph.</p>
  </section>;
}

function Cases({cases,onSelect,selected}:{cases:any[],onSelect:any,selected:string|null}){
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('All'),[page,setPage]=useState(0);
  const rows=cases.filter(c=>(filter==='All'||c.status===filter.toLowerCase())&&`${c.id} ${c.account}`.toLowerCase().includes(query.toLowerCase()));
  const max=Math.max(0,Math.ceil(rows.length/8)-1);
  useEffect(()=>setPage(0),[query,filter,cases.length]);
  const current=Math.min(page,max);

  return <section className="panel cases-table">
    <div className="section-heading">
      <div><p className="eyebrow">Investigation queue</p><h2>Account cases <span>{rows.length}</span></h2></div>
      <div className="table-controls">
        <label className="search-field"><Search size={14}/><input aria-label="Search cases" placeholder="Search account or case…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div className="segments">{['All','Pending','Reviewed','Expired'].map(f=><button key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f}</button>)}</div>
      </div>
    </div>
    <div className="table-scroll">
      <table>
        <thead>
          <tr><th>Case</th><th>Pseudonym Account</th><th>Score</th><th>Flagged events</th><th>Created (UTC)</th><th>Status</th><th/></tr>
        </thead>
        <tbody>
          {rows.slice(current*8,current*8+8).map(c=>(
            <tr key={c.id} className={selected===c.id?'selected-row':''}>
              <td className="mono">{c.id}</td>
              <td>{c.account}</td>
              <td className="mono">{c.score.toFixed(3)}</td>
              <td>{c.event_count}</td>
              <td className="muted-text">{date(c.created)}</td>
              <td><span className={`status-tag ${c.status}`}>{c.status}</span></td>
              <td><button className="text-button" onClick={()=>onSelect(c.id)}>Inspect <ArrowRight size={13}/></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {rows.length===0&&<Empty text="No cases match these filters."/>}
    <div className="pagination">
      <span>{rows.length?current*8+1:0}–{Math.min((current+1)*8,rows.length)} of {rows.length} cases</span>
      <button className="icon-button" aria-label="Previous cases page" disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft size={15}/></button>
      <button className="icon-button" aria-label="Next cases page" disabled={current>=max} onClick={()=>setPage(current+1)}><ChevronRight size={15}/></button>
    </div>
  </section>;
}

function TransactionTable({events,threshold,currency,onSelectTx}:{events:any[],threshold:number,currency:string,onSelectTx?:(tx:any)=>void}){
  return <section className="panel">
    <div className="section-heading">
      <div><p className="eyebrow">Event stream</p><h2>Recent transactions</h2></div>
      <span className="badge">Latest {events.length} observed · Click to inspect</span>
    </div>
    <div className="table-scroll">
      <table>
        <thead><tr><th>Transaction</th><th>Route (Pseudonym)</th><th>Amount ({currency})</th><th>Time (UTC)</th><th>Model score</th><th>Signal</th><th/></tr></thead>
        <tbody>
          {events.map(e=>(
            <tr key={e.id} className={onSelectTx?'clickable-row':''} onClick={()=>onSelectTx?.(e)}>
              <td className="mono">{e.id}</td>
              <td><span className="route">{e.source}<ArrowRight size={12}/>{e.target}</span></td>
              <td className="mono">{num(e.amount)}</td>
              <td className="muted-text">{date(e.timestamp)}</td>
              <td>
                <span className="score-cell">
                  <span className="score-track"><i style={{width:`${Math.min(100,e.score*100)}%`}}/></span>
                  <span className="mono">{e.score.toFixed(3)}</span>
                </span>
              </td>
              <td><span className={`status-tag ${e.score>=threshold?'pending':''}`}>{e.score>=threshold?'Flagged':'Below threshold'}</span></td>
              <td>
                {onSelectTx&&(
                  <button className="text-button" onClick={(ev)=>{ev.stopPropagation();onSelectTx(e);}}>
                    Inspect <ArrowRight size={12}/>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {!events.length&&<Empty text="No events observed yet."/>}
  </section>;
}

function Experiments({experiment:e,seed,setSeed,busy,onRun}:{experiment:any,seed:number,setSeed:any,busy:boolean,onRun:any}){
  const models=Object.entries(e.models) as [string,any][];
  const omitted=e.omitted_models||{};

  return <>
    <div className="experiment-toolbar">
      <div>
        <span className="badge"><Check size={12}/>Completed run</span>
        <span className="mono muted-text">{e.id} · CPU · seed {e.seed}</span>
      </div>
      <a className="btn" href="/api/export" download><ArrowDownToLine size={15}/>Export results</a>
    </div>

    <div className="metric-strip">
      <span><b>60 / 20 / 20</b> chronological split</span>
      <span><b>50 / 10k</b> review capacity</span>
      <span><b>24h</b> detection deadline</span>
      <span><b>1</b> executed seed</span>
    </div>

    <section className="panel">
      <div className="section-heading">
        <div><p className="eyebrow">Held-out evaluation</p><h2>Model comparison</h2></div>
        <span className="badge">Frozen validation thresholds</span>
      </div>
      <div className="table-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Model</th><th>PR-AUC</th><th>Avg. precision</th><th>F1</th><th>Precision</th><th>Recall</th><th>FPR</th><th>Timely recall</th><th>False reviews / 1k</th><th>Detection delay (h)</th>
            </tr>
          </thead>
          <tbody>
            {models.map(([k,d])=>(
              <tr key={k}>
                <td>
                  <strong>{names[k]||k}</strong>
                  <small>{k==='tgn'?'Event memory + past neighbours':k==='snapshot'?'6-hour snapshots':k==='graph'?'16 causal features':'11 history features'}</small>
                </td>
                {['pr_auc','average_precision','f1','precision','recall','false_positive_rate'].map(x=>(
                  <td key={x} className="mono">{pct(d.metrics[x])}</td>
                ))}
                <td className="mono" title={d.metrics.episode_note||undefined}>
                  {d.metrics.eligible_episodes>0?pct(d.metrics.timely_recall):<span className="muted-text" style={{fontSize:10}}>Unavailable</span>}
                </td>
                <td className="mono">{num(d.metrics.false_reviews_per_1000)}</td>
                <td className="mono">{num(d.metrics.mean_detected_delay_hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {omitted.snapshot&&(
        <div className="model-omitted-notice">
          <Info size={16}/>
          <div>
            <strong>Snapshot GNN Unavailable:</strong> {omitted.snapshot.reason}
          </div>
        </div>
      )}

      <p className="panel-footnote">
        PR-AUC uses trapezoidal integration; average precision is reported separately. Timely recall requires independently annotated multi-day incident episodes with ≥24h follow-up; marked &quot;Unavailable&quot; when absent. Detection delay averages timely detected episodes only.
      </p>
    </section>

    <div className="two-column">
      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Execution profile</p><h2>Training & scoring</h2></div>
          <Clock3 size={18}/>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Model</th><th>Train (s)</th><th>Mean scoring (ms/event)</th></tr></thead>
            <tbody>
              {models.map(([k,d])=>(
                <tr key={k}>
                  <td>{names[k]||k}</td>
                  <td className="mono">{num(d.training_seconds,3)}</td>
                  <td className="mono">{num(d.mean_scoring_ms,5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-footnote">Amortized inference timing from a full pass, excluding feature extraction and UI.</p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Reproducibility</p><h2>Run configuration</h2></div>
          <FlaskConical size={18}/>
        </div>
        <dl className="details-list">
          <div><dt>Neural training</dt><dd>3 epochs · CPU</dd></div>
          <div><dt>Case cooldown / expiry</dt><dd>6 hours / 24 hours</dd></div>
          <div><dt>Same-time events</dt><dd>Score before group update</dd></div>
          <div><dt>Queue priority</dt><dd>Highest score first</dd></div>
        </dl>
        <div className="run-config">
          <label>Next model seed<input type="number" min="0" max="999999" value={seed} onChange={ev=>setSeed(Number(ev.target.value))}/></label>
          <Button icon={RotateCcw} rotate onClick={onRun} disabled={busy}>Rerun models</Button>
        </div>
        <p className="panel-footnote">Rerunning creates a new traceable run archive (run-*.json). The active dataset stays fixed.</p>
      </section>
    </div>
  </>;
}

function Dataset({experiment:e,limits,onImport,onReset,busy}:{experiment:any,limits:any,onImport:any,onReset:any,busy:boolean}){
  const a=e.audit;
  const labelInfo=a?.label_info;

  return <>
    <div className="two-column">
      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Active dataset</p><h2 title={a.name}>{shorten(a.name, 34)}</h2></div>
          <Database size={19}/>
        </div>
        <dl className="details-list">
          <div><dt>Transactions / accounts</dt><dd>{num(a.transactions)} / {num(a.accounts,0)}</dd></div>
          <div><dt>Positive / labelled events</dt><dd>{num(a.positives,0)} / {num(a.labelled,0)}</dd></div>
          <div><dt>Annotated episodes</dt><dd>{a.episodes>0?num(a.episodes,0):'0 (Unavailable)'}</dd></div>
          <div><dt>Period (UTC)</dt><dd>{date(a.start)} – {date(a.end)}</dd></div>
          <div><dt>Currency</dt><dd>{a.currency}</dd></div>
        </dl>
        <p className="eyebrow checksum-label">Data fingerprint · SHA-256</p>
        <code className="checksum">{a.checksum}</code>
        <div className="dataset-actions">
          <Button icon={Upload} onClick={onImport} disabled={busy}>Import CSV</Button>
          <a className="btn" href="/api/demo.csv" download><ArrowDownToLine size={14}/>Sample CSV</a>
          <Button icon={RotateCcw} onClick={onReset} disabled={busy}>Reset demo</Button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Temporal protocol</p><h2>Keep the future unseen</h2></div>
          <Layers3 size={19}/>
        </div>
        <div className="split-bar">
          <div style={{width:'60%'}}>TRAIN</div>
          <div style={{width:'20%'}}>VALIDATE</div>
          <div style={{width:'20%'}}>TEST</div>
        </div>
        {['Train','Validation','Test'].map((n,i)=>(
          <div className="split-row" key={n}>
            <span><i className="legend-dot" style={{opacity:1-i*.3}}/>{n}</span>
            <strong>{num(a.partitions[i],0)} events</strong>
            <span>{[60,20,20][i]}% time</span>
          </div>
        ))}
        <p className="panel-footnote">Splits use elapsed time. Feature scaling and model fitting use training data. Threshold selection uses validation only. Identifiers are pseudonymized.</p>
        <div className="inline-note"><ShieldCheck size={16}/><span>Prediction features never include labels or episode identifiers.</span></div>
      </section>
    </div>

    {labelInfo&&(
      <div className="label-audit-card">
        <h3><ShieldAlert size={16}/> Label Semantics &amp; Ground Truth Audit</h3>
        <p style={{color:'#c8c8d0'}}>{labelInfo.disclaimer}</p>
        <div className="label-audit-grid">
          <div><dt>Original Field</dt><dd className="mono">{labelInfo.field}</dd></div>
          <div><dt>Signal Nature</dt><dd>{labelInfo.type==='payment_failure_proxy'?'Payment Failure / Decline Proxy':'Ground Truth Fraud / Episode'}</dd></div>
          <div><dt>Mapping Rule</dt><dd>{labelInfo.mapping}</dd></div>
        </div>
        {labelInfo.breakdown?.top_failures&&(
          <div style={{marginTop:12}}>
            <p className="eyebrow">Top Gateway Failure Codes (Mapped to 1-label):</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
              {labelInfo.breakdown.top_failures.map(([msg,cnt]:any)=>(
                <span key={msg} className="badge" style={{fontSize:10}}>
                  {msg}: <b>{cnt}</b>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )}

    <section className="panel" style={{marginTop:20}}>
      <div className="section-heading">
        <div><p className="eyebrow">CSV contract</p><h2>Bring your transaction data</h2></div>
        <span className="badge">≤{limits.max_file_size_mb} MB · {limits.min_transactions}–{limits.max_transactions.toLocaleString()} rows · ≤{limits.max_accounts.toLocaleString()} accounts</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Field</th><th>Requirement</th><th>Format</th><th>Use</th></tr></thead>
          <tbody>
            {[
              ['timestamp','Required','ISO 8601 with timezone, or Unix seconds','Chronological event time'],
              ['source / target','Required','Distinct account or phone identifiers','Directed endpoints (auto-pseudonymized)'],
              ['amount','Required','Positive finite number (commas stripped)','Transaction value'],
              ['label','Required for training','0 = legitimate, 1 = suspicious','Training and offline evaluation'],
              ['episode_id','For episode evaluation','Shared identifier on confirmed incidents','Independent episode recall (optional)'],
              ['id / currency','Optional','Unique event ID / single currency','Identity and display']
            ].map(row=>(
              <tr key={row[0]}>{row.map((c,i)=><td key={i} className={i===0?'mono':''}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-footnote">
        TheTeller merchant reports are auto-parsed (date → timestamp, source/merchant_id → pseudonymized accounts, status → failure proxy label). Invalid CSV imports are rejected with a clear error without altering the active experiment.
      </p>
    </section>

    {a.warnings?.length>0&&(
      <div className="notice" style={{marginTop:20}}>
        <Info size={16}/>
        <span>{a.warnings.join(' ')}</span>
      </div>
    )}
  </>;
}

createRoot(document.getElementById('root')!).render(<App/>);
