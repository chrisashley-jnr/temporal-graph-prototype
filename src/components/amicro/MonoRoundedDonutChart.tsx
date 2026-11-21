// Adapted from Amicro MonoRoundedDonutChart, MIT. Values represent actual replay cases.
import { useState } from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer,PieChart,Pie,Cell,Tooltip } from 'recharts';
import { DitherChartTooltipContent } from './tooltip';

export function MonoRoundedDonutChart({data,theme='dark'}:{data:{name:string,value:number}[],theme?:'light'|'dark'}) {
  const [hover,setHover]=useState<number|null>(null);
  const total=data.reduce((a,b)=>a+b.value,0);
  const active=hover===null?null:data[hover];
  const isDark = theme === 'dark';
  const colors = isDark ? ['#ffffff','#a7a7ad','#48484e'] : ['#18181b','#64748b','#cbd5e1'];

  return <motion.div initial={{opacity:0,scale:.98,y:6}} animate={{opacity:1,scale:1,y:0}} transition={{duration:.25,ease:[.16,1,.3,1]}}
    className={`rounded-3xl overflow-hidden p-4 transition-all duration-250 ${isDark ? 'bg-[#141414] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-white/20' : 'bg-white border border-black/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:border-black/20'}`}>
    <div className="chart-heading"><div><p className="eyebrow">Case distribution</p><div className="readout">{total} <span>created cases</span></div></div><span className="badge">By status</span></div>
    <div className={`relative rounded-[14px] ${isDark ? 'bg-[#131313]' : 'bg-[#f4f5f8]'}`} style={{height:198}}>
      {total>0?<ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip content={<DitherChartTooltipContent theme={theme}/>}/><Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={5} cornerRadius={7} strokeLinecap="round" onMouseEnter={(_,i)=>setHover(i)} onMouseLeave={()=>setHover(null)} isAnimationActive={false}>
        {data.map((d,i)=><Cell key={d.name} fill={colors[i]} stroke="transparent"/>)}</Pie></PieChart></ResponsiveContainer>:<div className="empty-donut"/>}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><strong className="text-2xl tabular-nums">{active?active.value:total}</strong><span className={`text-[10px] uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{active?active.name:'Total cases'}</span></div>
    </div><div className="donut-legend">{data.map((d,i)=><span key={d.name}><i className="legend-dot" style={{background:colors[i]}}/>{d.name}<b>{d.value}</b></span>)}</div>
  </motion.div>;
}
