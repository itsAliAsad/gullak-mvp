import { GullakLogo } from '@/components/GullakLogo'
import { ExternalLink } from 'lucide-react'

const LINKS = [
  { id: 'home',  desktop: 'Experience Gullak', mobile: 'Chat'   },
  { id: 'about', desktop: 'About',             mobile: 'About'  },
  { id: 'team',  desktop: 'Meet the Team',     mobile: 'Team'   },
]

export function Navbar({ currentPage, onNavigate }) {
  return (
    <nav className="h-20 bg-white border-b border-sand flex items-center justify-between px-5 shrink-0 z-20">
      {/* Wordmark */}
      <button
        onClick={() => onNavigate('home')}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        <GullakLogo className="w-12 h-12" />
        <span className="font-bold text-terracotta text-2xl leading-none" style={{ fontFamily: 'Georgia, serif' }}>گُلّک</span>
      </button>

      {/* Links */}
      <div className="flex items-center gap-0.5">
        <div className="hidden md:flex items-center mr-4 text-xs font-medium text-muted/80 bg-sand/20 px-2.5 py-1 rounded-full border border-sand/40">
          Built with <span className="ml-1 font-bold tracking-wide" style={{ color: '#B080FF' }}>Kiro</span>
        </div>
        
        {LINKS.map(link => {
          const active = currentPage === link.id
          return (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-terracotta-light text-terracotta'
                  : 'text-muted hover:text-brown hover:bg-sand/30'
              }`}
            >
              <span className="hidden sm:inline">{link.desktop}</span>
              <span className="sm:hidden">{link.mobile}</span>
            </button>
          )
        })}
        {/* GitHub Link */}
        <a
          href="https://github.com/itsAliAsad/gullak-mvp"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted hover:text-brown hover:bg-sand/30 transition-colors flex items-center gap-2"
        >
          <span className="hidden sm:inline">GitHub</span>
          <ExternalLink size={16} />
        </a>
      </div>
    </nav>
  )
}
