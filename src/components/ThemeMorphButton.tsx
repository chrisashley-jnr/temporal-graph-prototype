import React, { useId } from 'react';
import { motion } from 'motion/react';

export interface ThemeMorphButtonProps {
  theme: 'light' | 'dark';
  onToggle: (nextTheme: 'light' | 'dark') => void;
  className?: string;
}

export function ThemeMorphButton({ theme, onToggle, className }: ThemeMorphButtonProps) {
  const isDark = theme === 'dark';
  const maskId = useId();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = isDark ? 'light' : 'dark';

    // View Transitions API circular reveal (Transition Kit pattern)
    const doc = document as any;
    if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = doc.startViewTransition(() => {
        onToggle(nextTheme);
      });

      transition.ready?.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 450,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      });
    } else {
      onToggle(nextTheme);
    }
  };

  return (
    <motion.button
      type="button"
      className={`theme-morph-btn ${className || ''}`}
      onClick={handleClick}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ rotate: isDark ? 40 : 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        style={{ overflow: 'visible' }}
      >
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <motion.circle
            animate={{
              cx: isDark ? 19 : 26,
              cy: isDark ? 5 : 0,
              r: isDark ? 9 : 0
            }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
            fill="black"
          />
        </mask>

        {/* Center circle: morphs between sun disk and moon body */}
        <motion.circle
          cx="12"
          cy="12"
          animate={{ r: isDark ? 9 : 5 }}
          transition={{ type: 'spring', stiffness: 240, damping: 20 }}
          fill="currentColor"
          mask={`url(#${maskId})`}
        />

        {/* Sun rays: animate/rotate outward in light mode, collapse away in dark mode */}
        <motion.g
          stroke="currentColor"
          animate={{
            opacity: isDark ? 0 : 1,
            scale: isDark ? 0.3 : 1,
            rotate: isDark ? -90 : 0
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          style={{ transformOrigin: '12px 12px' }}
        >
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </motion.g>
      </motion.svg>
    </motion.button>
  );
}
