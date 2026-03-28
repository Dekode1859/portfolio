import { PORTFOLIO_CONFIG } from '@/config';

export default function NavBar() {
  const links = ["About", "Projects", "Skills", "Contact"];

  return (
    <nav className="sticky top-0 z-50 w-full glass nav-glow pointer-events-auto">
      <div className="mx-auto max-w-7xl px-6 lg:px-12 flex items-center justify-between h-14">
        {/* Brand */}
        <span className="font-mono text-sm text-cyan-neon text-glow-cyan tracking-widest select-none">
          {PORTFOLIO_CONFIG.navTitle}
        </span>

        {/* Nav links */}
        <ul className="hidden sm:flex items-center gap-8">
          {links.map((link) => (
            <li key={link}>
              <a
                href={`#${link.toLowerCase()}`}
                className="font-mono text-xs tracking-widest text-zinc-400 hover:text-cyan-neon transition-colors duration-200 uppercase"
              >
                {link}
              </a>
            </li>
          ))}
        </ul>

        {/* Mobile: abbreviated label */}
        <span className="sm:hidden font-mono text-xs text-zinc-600 tracking-widest">
          [ MENU ]
        </span>
      </div>
    </nav>
  );
}
