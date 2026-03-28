'use client';

import { useRef, useEffect } from 'react';
import { useInView } from 'framer-motion';
import { useStore } from '@/store';
import { PORTFOLIO_CONFIG } from '@/config';
import type { ProjectConfig } from '@/config';

// ─── Single project block ─────────────────────────────────────────────────────

function ProjectBlock({ project, index }: { project: ProjectConfig; index: number }) {
  const sectionRef = useRef<HTMLDivElement>(null);

  // Fire when this section crosses into the central 20% of the viewport.
  const isInView = useInView(sectionRef, { margin: '-40% 0px -40% 0px' });

  useEffect(() => {
    if (isInView) {
      useStore.setState({ activeCluster: project.id });
    }
  }, [isInView, project.id]);

  const ordinal = String(index + 1).padStart(2, '0');

  return (
    <div
      ref={sectionRef}
      className="min-h-screen flex items-center px-6 sm:px-12 lg:px-24 snap-center"
    >
      {/* Card — left half only; right side is empty so the 3D cluster shows through */}
      <article
        className="w-full max-w-lg glass border-cyan-glow rounded-lg p-8 flex flex-col gap-5 pointer-events-auto"
        onMouseEnter={() => useStore.setState({ hoveredProject: project.id })}
        onMouseLeave={() => useStore.setState({ hoveredProject: null })}
      >
        {/* Ordinal tag */}
        <span className="font-mono text-xs text-zinc-600 tracking-widest select-none">
          [ PROJECT_{ordinal} ]
        </span>

        {/* Title */}
        <h3 className="font-sans text-xl font-bold text-white leading-snug">
          {project.title}
        </h3>

        {/* Description */}
        <p className="font-sans text-sm text-zinc-400 leading-relaxed">
          {project.description}
        </p>

        {/* Tech stack badges */}
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

        {/* Link */}
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
  // Reset activeCluster when the entire section leaves the viewport
  const sectionRef    = useRef<HTMLElement>(null);
  const sectionInView = useInView(sectionRef, { margin: '0px' });

  useEffect(() => {
    if (!sectionInView) {
      useStore.setState({ activeCluster: null });
    }
  }, [sectionInView]);

  return (
    <section id="projects" ref={sectionRef} className="scroll-mt-14">
      {/* Headline is now rendered by the fixed <SectionHeadline /> component
          in page.tsx so it persists across both Projects and Skills sections. */}

      {PORTFOLIO_CONFIG.projects.map((project, i) => (
        <ProjectBlock key={project.id} project={project} index={i} />
      ))}
    </section>
  );
}
