// Adapted from Amicro MonoRoundedKpiCardChart, MIT. Removed fixture financial data.
import { useId } from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer,AreaChart,Area,Tooltip } from 'recharts';

export function MonoRoundedKpiCardChart({title,value,note,data,icon:Icon,theme='dark'}:{title:string,value:string,note:string,data?:{period:string,val:number}[],icon:any,theme?:'light'|'dark'}) {
  const gradient=useId();
  const isDark = theme === 'dark';
  const color = isDark ? '#ffffff' : '#18181b';

  return <motion.div initial={{opacity:0,scale:.98,y:6}} animate={{opacity:1,scale:1,y:0}} transition={{duration:.25,ease:[.16,1,.3,1]}}
    className={`kpi relative rounded-3xl overflow-hidden p-4 transition-all duration-250 ${isDark ? 'bg-[#141414] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-white/20' : 'bg-white border border-black/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:border-black/20'}`}>
    <div className="kpi-label"><span>{title}</span><Icon size={15}/></div><div className="kpi-value">{value}</div><p className="kpi-note">{note}</p>
    {data&&data.length>1&&<div className="kpi-spark"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.25}/><stop offset="100%" stopColor={color} stopOpacity={0}/></linearGradient></defs>
      <Tooltip content={({active,payload})=>active&&payload?.length?<div className="chart-tooltip">{payload[0].payload.period}: {Number(payload[0].value).toLocaleString()}</div>:null}/>
      <Area type="monotone" dataKey="val" stroke={color} strokeWidth={2} strokeLinecap="round" fill={`url(#${gradient})`} isAnimationActive={false}/>
    </AreaChart></ResponsiveContainer></div>}
  </motion.div>;
}
