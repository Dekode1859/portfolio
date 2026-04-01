'use client';

import { useRef, useEffect } from 'react';
import { useInView } from 'framer-motion';
import { useStore } from '@/store';
import { PORTFOLIO_CONFIG } from '@/config';
import type { ProjectConfig } from '@/config';

// ─── Single project block ─────────────────────────────────────────────────────

function ProjectBlock({ project, index }: { project: ProjectConfig; index: number }) {
  const sectionRef = useRef<HTMLDivElement>(null);

  // Strictly centred — identical margin to Hero, Skills, and every other block.
  // Only fires when the card crosses the centre 10% of the viewport.
  const isInView = useInView(sectionRef, { margin: '-45% 0px -45% 0px' });

  useEffect(() => {
    if (isInView) {
      useStore.setState({ activeCluster: project.id });
    }
    // No !isInView — the adjacent section's observer takes over.
  }, [isInView, project.id]);

  const ordinal = String(index + 1).padStart(2, '0');

  return (
    <div
      ref={sectionRef}
      className="min-h-screen flex items-center px-6 sm:px-12 lg:px-24 snap-center"
    >
      <article
        className="w-full max-w-lg glass border-cyan-glow rounded-lg p-8 flex flex-col gap-5 pointer-events-auto"
        onMouseEnter={() => useStore.setState({ hoveredProject: project.id })}
        onMouseLeave={() => useStore.setState({ hoveredProject: null })}
      >
        <span className="font-mono text-xs text-zinc-600 tracking-widest select-none">
          [ PROJECT_{ordinal} ]
        </span>

        <h3 className="font-sans text-xl font-bold text-white leading-snug">
          {project.title}
        </h3>

        <p className="font-sans text-sm text-zinc-400 leading-relaxed">
          {project.description}
        </p>

        <div className="flex flex-wrap gap-2">
          {project.techStack.map((tag) => (
            <span
              key={tag}
              className="font-mono text-xs px-2 py-0.5 rounded-full bg-cyan-neon/10 text-cyan-neon border border-cyan-neon/30"
            >
              {tag}
            </span>
          ))}
        </div>

        <a
          href={project.href}
          className="font-mono text-xs text-magenta hover:text-glow-magenta tracking-widest uppercase transition-all duration-200 self-start"
        >
          View →
        </a>
      </article>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export default function ProjectsSection() {
  // No outer section-level reset observer — each ProjectBlock's strictly-centred
  // useInView handles its own state, and the adjacent Hero/Skills sections
  // handle theirs. This eliminates all race conditions on scroll reversal.
  return (
    <section id="projects" className="scroll-mt-14">
      {PORTFOLIO_CONFIG.projects.map((project, i) => (
        <ProjectBlock key={project.id} project={project} index={i} />
      ))}
    </section>
  );
}
