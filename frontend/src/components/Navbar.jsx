import { GullakLogo } from '@/components/GullakLogo'

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
      </div>
    </nav>
  )
}
