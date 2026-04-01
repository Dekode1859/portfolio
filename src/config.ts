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
  coreSystems:        string[];
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

// ─── Master skills list (Skills polyhedron — Cluster 4) ───────────────────────
// Derived automatically from the skills config. Deduplication ensures the
// Fibonacci sphere generates exactly one node per unique skill.
// Exported so BackgroundNetwork.tsx can generate Cluster 4 geometry from it.
export const MASTER_SKILLS: string[] = (() => {
  // Can't reference PORTFOLIO_CONFIG yet (declared below), so inline the arrays.
  // Keep these in sync with the skills block below.
  const core = [
    'Python', 'TypeScript', 'FastAPI', 'System Architecture', 
    'AWS Cloud Architecture', 'Docker', 'RAG Architectures', 'Agentic AI', 
    'React', 'PostgreSQL', 'Microservices', 'Decentralized Infrastructure',
    'API Design', 'Database Modeling'
  ];
  const tools = [
    'Temporal', 'LangChain', 'Next.js',  
    'Ollama', 'OpenAI API', 'CI/CD Pipelines', 'Proxmox', 
    'Git', 'OpenCode SDK', 'Cloudflare Tunnels', 'LXC',
    'Webhooks', 'Tauri', 'GitHub Apps', 'Linux'
  ];
  return [...new Set([...core, ...tools])];
})();

export const PORTFOLIO_CONFIG: PortfolioConfig = {
  navTitle: '> AI_ARCHITECT_PROFILE',

  hero: {
    name:        'Pratik Dwivedi',
    role:        'AI Systems Architect',
    description:
      'I build systems, not just models. I map out how complex systems will function, scale, and communicate before a single line of code is written. I focus on finding the cleanest, industry-standard ways to orchestrate cloud environments, structure databases, and manage tight resource constraints. Whether it\'s designing agentic workflows or architecting decentralized infrastructure, I prioritize production-grade reliability and maintainability.',
  },

  projects: [
    {
      id:          1,
      title:       'Align: Agentic Slack Orchestrator',
      description: 'A Slack-first AI agent that synthesizes technical conversations into structured GitHub issues. Fully managed by Temporal workflows for fault-tolerant execution and state management.',
      techStack:   ['Python', 'Temporal', 'Agentic AI', 'OpenAI API', 'FastAPI', 'Webhooks'],
      href:        '#',
    },
    {
      id:          2,
      title:       'CodeForge: Autonomous SWE Agent',
      description: 'An orchestrator agent utilizing the OpenCode SDK to automate software engineering tasks. It handles high-level planning, coding execution, and pull request generation seamlessly.',
      techStack:   ['Python',  'LangChain', 'Docker', 'TypeScript', 'GitHub Apps'],
      href:        '#',
    },
    {
      id:          3,
      title:       'Decentralized App Infrastructure',
      description: 'A production-grade, self-hosted environment for personal applications. Built on Proxmox and LXC containers, routed securely via Cloudflare Tunnels with a unified FastAPI gateway.',
      techStack:   ['Proxmox', 'LXC', 'Docker', 'Cloudflare Tunnels', 'FastAPI', 'System Architecture'],
      href:        '#',
    },
  ],

  skills: {
    coreSystems: [
      'Python', 'TypeScript', 'FastAPI', 'System Architecture', 
      'AWS Cloud Architecture', 'Docker', 'RAG Architectures', 'Agentic AI', 
      'React', 'PostgreSQL', 'Microservices', 'Decentralized Infrastructure',
      'API Design', 'Database Modeling'
    ],
    toolsAndFrameworks: [
      'Temporal', 'LangChain', 'Next.js',  
      'Ollama', 'OpenAI API', 'CI/CD Pipelines', 'Proxmox', 
      'Git', 'OpenCode SDK', 'Cloudflare Tunnels', 'LXC',
      'Webhooks', 'Tauri', 'GitHub Apps', 'Linux'
    ],
  },
};