// Narrow adaptation of Amicro AnimatedButton: spring, rotate interaction and original button surfaces.
import {useState} from 'react';
import {motion} from 'motion/react';
export function AnimatedButton({children,icon:Icon,onClick,primary=false,disabled=false,rotate=false,title}:{children:any,icon?:any,onClick?:()=>void,primary?:boolean,disabled?:boolean,rotate?:boolean,title?:string}) {
  const [hover,setHover]=useState(false);
  return <motion.button type="button" title={title} disabled={disabled} onClick={onClick} onHoverStart={()=>setHover(true)} onHoverEnd={()=>setHover(false)} whileHover={disabled?{}:{scale:1.02}} whileTap={disabled?{}:{scale:.97}} transition={{type:'spring',stiffness:500,damping:28}}
    className={`btn ${primary?'primary':''}`}><motion.span className="button-icon" animate={{rotate:hover&&rotate?180:0}} transition={{type:'spring',stiffness:400,damping:28}}>{Icon&&<Icon size={15}/>}</motion.span>{children}</motion.button>;
}
