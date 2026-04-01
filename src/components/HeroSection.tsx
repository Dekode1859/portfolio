'use client';

import { useRef, useEffect } from 'react';
import { useInView } from 'framer-motion';
import { useStore } from '@/store';
import { PORTFOLIO_CONFIG } from '@/config';

const { hero } = PORTFOLIO_CONFIG;

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  // Reset the active cluster as soon as the hero section re-enters the
  // viewport (e.g. user scrolls back to the top from the projects section).
  // The margin fires slightly before the element is fully visible so the
  // 3D network snaps back to the global view with no perceivable delay.
  // Same strictly-centred observer as every Project card and Skills section.
  // When Hero sits at the screen centre → global idle (activeCluster null).
  const isInView = useInView(sectionRef, { margin: '-45% 0px -45% 0px' });

  useEffect(() => {
    if (isInView) {
      useStore.setState({ activeCluster: null });
    }
    // No !isInView branch — the next section's observer sets its own state.
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      id="about"
      className="min-h-screen flex flex-col justify-center px-6 sm:px-12 lg:px-24 py-24 snap-center"
    >
      <div className="max-w-4xl">
        {/* Eyebrow */}
        <p className="font-mono text-xs text-cyan-neon tracking-[0.3em] mb-6 uppercase">
          &gt; INITIALIZING_AGENT
          <span className="cursor-blink ml-1">_</span>
        </p>

        {/* Name */}
        <h1 className="font-sans text-5xl sm:text-7xl font-bold text-white tracking-tight mb-4 leading-none">
          {hero.name}
        </h1>

        {/* Role */}
        <h2 className="font-mono text-xl sm:text-3xl font-semibold text-cyan-neon text-glow-cyan mb-8">
          {hero.role}
        </h2>

        {/* Bio */}
        <p className="font-sans text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed mb-12">
          {hero.description}
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-4 pointer-events-auto">
          <a
            href="#projects"
            className="font-mono text-sm tracking-widest uppercase px-6 py-3 rounded border-cyan-glow bg-cyan-neon/10 text-cyan-neon hover:bg-cyan-neon/20 transition-colors duration-200"
          >
            View Projects
          </a>
          <a
            href="https://www.linkedin.com/in/pratik-dwivedi/"
            className="font-mono text-sm tracking-widest uppercase px-6 py-3 rounded border-magenta-glow bg-magenta/10 text-magenta hover:bg-magenta/20 transition-colors duration-200"
          >
            Contact Me
          </a>
        </div>

        {/* Decorative grid tag */}
        <p className="font-mono text-xs text-zinc-500 mt-16 tracking-widest">
          [ NODE_ID: {hero.nodeId} ] [ STATUS: ONLINE ] [ Github:
          <a
            href={hero.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-cyan-neon hover:text-glow-cyan transition-all duration-200 underline underline-offset-2 pointer-events-auto cursor-pointer ml-1"
          >
            /Dekode1859
          </a>
          ]
        </p>
      </div>
    </section>
  );
}
