import React from 'react';
import { motion } from 'motion/react';

export interface MatrixOrbProps {
  className?: string;
  size?: number;
}

/**
 * Rare UI Matrix / Fluid Orb ambient background element
 * Inspired by rareui.com/components (AI Kit: Matrix Orb / Fluid Orb)
 */
export function MatrixOrb({ className = '', size = 520 }: MatrixOrbProps) {
  return (
    <div
      className={`rare-orb-wrapper pointer-events-none select-none ${className}`}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: size,
        height: size,
        zIndex: 0,
        overflow: 'visible'
      }}
      aria-hidden="true"
    >
      {/* Outer ambient glow */}
      <motion.div
        animate={{
          scale: [1, 1.08, 0.98, 1],
          opacity: [0.35, 0.5, 0.38, 0.35]
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(120, 119, 198, 0.22) 0%, rgba(59, 130, 246, 0.12) 40%, rgba(16, 185, 129, 0.04) 70%, transparent 85%)',
          filter: 'blur(45px)'
        }}
      />

      {/* Inner pulsating core */}
      <motion.div
        animate={{
          scale: [0.92, 1.04, 0.95, 0.92],
          rotate: [0, 90, 180, 270, 360]
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: 'linear'
        }}
        style={{
          position: 'absolute',
          top: '20%',
          left: '20%',
          width: '60%',
          height: '60%',
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, rgba(255, 255, 255, 0.08), rgba(99, 102, 241, 0.18), rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.15), rgba(255, 255, 255, 0.08))',
          filter: 'blur(30px)'
        }}
      />

      {/* Subtle particle matrix grid dots */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 520 520"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.22,
          mixBlendMode: 'screen'
        }}
      >
        <defs>
          <radialGradient id="rare-grid-mask" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <pattern id="rare-grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rare-grid-dots)" mask="url(#rare-grid-mask)" />
      </svg>
    </div>
  );
}

export default MatrixOrb;
