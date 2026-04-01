'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/store';

/**
 * Fixed section headline bound directly to activeCluster state.
 * - null (Hero) → hidden
 * - 1 | 2 | 3  → "> SYSTEM.PROJECTS / Projects"
 * - 4           → "> SYSTEM.SKILLS / Skills"
 *
 * Because the text is state-driven (not scroll-driven), it physically
 * cannot desync from the 3D graph focus.
 */
export default function SectionHeadline() {
  const activeCluster = useStore(s => s.activeCluster);

  // Hidden during Hero (global idle)
  if (activeCluster === null) return null;

  const isSkills = activeCluster === 4;
  const eyebrow  = isSkills ? '> SYSTEM.SKILLS'   : '> SYSTEM.PROJECTS';
  const title    = isSkills ? 'Skills'             : 'Projects';
  const accent   = isSkills ? 'text-cyan-neon'     : 'text-magenta';
  const divider  = isSkills ? 'section-divider-cyan' : 'section-divider-magenta';

  return (
    <div className="fixed top-14 z-20 px-6 sm:px-12 lg:px-24 py-4 pointer-events-none w-full">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isSkills ? 'skills' : 'projects'}
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
      </AnimatePresence>
    </div>
  );
}
