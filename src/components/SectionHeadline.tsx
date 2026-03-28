'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/store';

export default function SectionHeadline() {
  const headerVisible = useStore(s => s.headerVisible);
  const viewMode      = useStore(s => s.viewMode);

  const isMatrix = viewMode === 'matrix';
  const eyebrow  = isMatrix ? '> SYSTEM.CAPABILITIES' : '> SYSTEM.PROJECTS';
  const title    = isMatrix ? 'Skills'                 : 'Projects';
  const accent   = isMatrix ? 'text-cyan-neon'         : 'text-magenta';
  const divider  = isMatrix ? 'section-divider-cyan'   : 'section-divider-magenta';

  return (
    // Fixed below the navbar at all times; pointer-events-none so it never
    // intercepts clicks meant for the 3D canvas or scroll-through cards.
    <div className="fixed top-14 z-20 px-6 sm:px-12 lg:px-24 py-4 pointer-events-none w-full">
      <AnimatePresence mode="wait" initial={false}>
        {headerVisible && (
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <p className={`font-mono text-xs ${accent} tracking-[0.3em] uppercase mb-2`}>
              {eyebrow}
            </p>
            <h2 className={`font-sans text-3xl sm:text-4xl font-bold text-white ${divider}`}>
              {title}
            </h2>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
