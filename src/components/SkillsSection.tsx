'use client';

import { useRef, useEffect } from 'react';
import { useInView } from 'framer-motion';
import { useStore } from '@/store';

export default function SkillsSection() {
  const sectionRef = useRef<HTMLElement>(null);

  // Identical observer to every ProjectBlock and Hero — strictly centred.
  // Only fires when this section physically sits in the centre 10% of the viewport.
  const isInView = useInView(sectionRef, { margin: '-45% 0px -45% 0px' });

  useEffect(() => {
    if (isInView) {
      useStore.setState({ activeCluster: 4 });
    }
    // No !isInView — adjacent Project 3's observer takes over on scroll-back.
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      id="skills"
      className="min-h-screen flex items-center px-6 sm:px-12 lg:px-24 snap-center"
    >
      <div className="font-mono text-xs text-zinc-700 tracking-widest flex flex-col gap-5">
        <p>[ SKILLS_MATRIX_ACTIVE ]</p>
        <p>[ ALL_NODES_ILLUMINATED ]<span className="cursor-blink ml-1 text-cyan-neon">_</span></p>
      </div>
    </section>
  );
}
