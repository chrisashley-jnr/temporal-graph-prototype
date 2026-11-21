// Adapted from Amicro (MIT). Layout, chart styling and motion retained; experiment data replace fixtures.
import { useState } from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DitherChartTooltipContent } from './tooltip';

export function MonoRoundedLineChart({data,total,theme='dark'}:{data:{label:string,value:number,secondary:number}[],total:number,theme?:'light'|'dark'}) {
  const [mode,setMode]=useState('All activity');
  const isDark = theme === 'dark';

  return <motion.div initial={{opacity:0,scale:.98,y:6}} animate={{opacity:1,scale:1,y:0}} transition={{duration:.25,ease:[.16,1,.3,1]}}
    className={`relative w-full rounded-3xl group flex flex-col overflow-hidden p-4 transition-all duration-250 ${isDark ? 'bg-[#141414] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-white/20' : 'bg-white border border-black/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:border-black/20'}`}>
    <div className="chart-heading"><div><p className="eyebrow">Transaction activity</p><div className="readout">{total.toLocaleString()} <span>observed events</span></div></div>
      <div className="segments">{['All activity','Alerts'].map(m=><button key={m} onClick={()=>setMode(m)} className={m===mode?'active':''}>{m}</button>)}</div></div>
    <div className={`rounded-[14px] p-2 ${isDark ? 'bg-[#131313]' : 'bg-[#f4f5f8]'}`} style={{height:210}}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:14,right:12,left:-24,bottom:0}}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.06)"}/>
      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={25} tick={{fontSize:10,fill:isDark?'#89898e':'#64748b'}}/>
      <YAxis domain={[0,'auto']} allowDecimals={false} tickLine={false} axisLine={false} tick={{fontSize:10,fill:isDark?'#89898e':'#64748b'}}/>
      <Tooltip content={<DitherChartTooltipContent theme={theme}/>}/>
      {mode==='All activity'&&<Line type="monotone" dataKey="value" name="Transactions" stroke={isDark ? '#fff' : '#18181b'} strokeWidth={3} strokeLinecap="round" dot={false} activeDot={{r:5}} isAnimationActive={false}/>}
      <Line type="monotone" dataKey="secondary" name="Threshold alerts" stroke={mode==='Alerts'?(isDark?'#fff':'#18181b'):(isDark?'#74747c':'#94a3b8')} strokeWidth={mode==='Alerts'?3:1.5} strokeDasharray={mode==='Alerts'?undefined:'4 4'} dot={false} isAnimationActive={false}/>
    </LineChart></ResponsiveContainer></div>
    <div className="chart-caption"><span><i className="legend-dot"/>Transactions</span><span><i className="legend-dot muted"/>Threshold alerts</span><span className="push">12 equal time bins · UTC</span></div>
  </motion.div>;
}
