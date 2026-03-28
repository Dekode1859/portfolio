// ─── Portfolio configuration — single source of truth ────────────────────────
//
// Edit this file to customise every piece of visible content.
// The 3D network's skill-node labels, the UI cards, and the nav bar all read
// from here, so a change in one place propagates everywhere automatically.

export interface ProjectConfig {
  /** Must be 1, 2, or 3 — maps to the matching 3D cluster subgraph. */
  id:          1 | 2 | 3;
  title:       string;
  description: string;
  /** Each entry becomes both a UI badge and a glowing 3D label node. */
  techStack:   string[];
  href:        string;
}

interface SkillsConfig {
  coreSystems:      string[];
  toolsAndFrameworks: string[];
}

interface HeroConfig {
  name:        string;
  role:        string;
  description: string;
}

interface PortfolioConfig {
  navTitle: string;
  hero:     HeroConfig;
  projects: ProjectConfig[];
  skills:   SkillsConfig;
}

export const PORTFOLIO_CONFIG: PortfolioConfig = {
  navTitle: '> AI_ARCHITECT_PROFILE',

  hero: {
    name:        'Pratik Dwivedi',
    role:        'AI Systems Architect',
    description:
      'I build production-grade agentic systems and hybrid RAG architectures. ' +
      'From orchestrating complex LLM workflows for fintech to designing decentralized, ' +
      'self-hosted infrastructure, I own the technical lifecycle from day zero to deployment.',
  },

  projects: [
    {
      id:          1,
      title:       'Align: Agentic Slack Orchestrator',
      description: 'A Slack-first AI agent that synthesizes technical conversations into structured GitHub issues. Fully managed by Temporal workflows for fault-tolerant execution and state management.',
      techStack:   ['Python', 'Temporal', 'LLMs', 'Slack API', 'GitHub Apps'],
      href:        '#',
    },
    {
      id:          2,
      title:       'CodeForge: Autonomous SWE Agent',
      description: 'An orchestrator agent utilizing the OpenCode SDK to automate software engineering tasks. It handles high-level planning, coding execution, and pull request generation seamlessly.',
      techStack:   ['Python', 'OpenCode SDK', 'Agentic Workflows', 'Git Orchestration'],
      href:        '#',
    },
    {
      id:          3,
      title:       'Decentralized App Infrastructure',
      description: 'A production-grade, self-hosted environment for personal applications. Built on Proxmox and LXC containers, routed securely via Cloudflare Tunnels with a unified FastAPI gateway.',
      techStack:   ['Proxmox', 'LXC', 'Cloudflare Tunnels', 'FastAPI', 'Docker'],
      href:        '#',
    },
  ],

  skills: {
    coreSystems: [
      'Python', 'FastAPI', 'System Architecture', 'AWS (EC2/RDS/S3)',
      'Agentic Workflows', 'Hybrid RAG', 'Local LLMs', 'Docker',
      'Database Design', 'TypeScript',
    ],
    toolsAndFrameworks: [
      'Temporal', 'LangChain', 'Next.js', 'React',
      'Proxmox', 'Cloudflare Tunnels', 'OpenCode SDK',
      'Git', 'PostgreSQL', 'GitHub Actions',
    ],
  },
};