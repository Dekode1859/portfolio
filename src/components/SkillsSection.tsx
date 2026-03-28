'use client';

import { useRef, useEffect } from 'react';
import { useInView } from 'framer-motion';
import { useStore } from '@/store';

export default function SkillsSection() {
  const sectionRef = useRef<HTMLElement>(null);

  // Fires when the Skills section crosses 10% into the viewport
  const isInView = useInView(sectionRef, { margin: '-10% 0px 0px 0px' });

  useEffect(() => {
    if (isInView) {
      // Enter matrix mode: zoom out to global view, light every skill edge
      useStore.setState({ viewMode: 'matrix', activeCluster: null });
    } else {
      // Leaving Skills (scrolling back up) — restore normal project mode
      useStore.setState({ viewMode: 'projects' });
    }
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      id="skills"
      className="min-h-screen snap-start flex items-end px-6 sm:px-12 lg:px-24 pb-16"
    >
      {/* No HTML badges — the 3D canvas displays the full skills matrix.
          A minimal footer tag anchors the section visually. */}
      <p className="font-mono text-xs text-zinc-700 tracking-widest">
        [ SKILLS_MATRIX_ACTIVE ] [ ALL_NODES_ILLUMINATED ]
        <span className="cursor-blink ml-1 text-cyan-neon">_</span>
      </p>
    </section>
  );
}
