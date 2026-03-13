import { GullakLogo } from '@/components/GullakLogo'

export function Landing({ onStart }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col p-6 relative overflow-x-hidden overflow-y-auto">
      {/* Decorative gradient orbs */}
      <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-sand/50 rounded-full blur-[100px] animate-pulse-slow pointer-events-none mix-blend-multiply" />
      <div className="absolute bottom-[10%] right-[15%] w-[400px] h-[400px] bg-terracotta-light/70 rounded-full blur-[100px] animate-pulse-slow pointer-events-none mix-blend-multiply" style={{ animationDelay: '2s' }} />
      
      {/* Main Content - Centered */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative z-10 flex flex-col items-center max-w-2xl text-center space-y-8 md:space-y-12">
          
          {/* Logo and Titles */}
          <div className="flex flex-col items-center space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="relative group animate-float">
              <div className="absolute -inset-6 bg-gradient-to-tr from-terracotta/20 to-brown/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition duration-700" />
              <GullakLogo className="w-40 h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 relative transform transition-transform duration-500 hover:scale-[1.02]" />
            </div>
            
            <div className="flex flex-col items-center space-y-2">
              <h1 className="text-5xl md:text-6xl lg:text-8xl font-bold text-brown tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
                Gullak
              </h1>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-terracotta" style={{ fontFamily: 'Georgia, serif' }}>
                گُلّک
              </h2>
            </div>
          </div>

          {/* Catchphrase */}
          <p className="text-lg md:text-xl lg:text-2xl text-brown/85 max-w-lg mx-auto leading-relaxed font-medium animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            Your savings grew up;<br/>it's about time your investments grew up too.
          </p>

          {/* CTA Button */}
          <div className="animate-fade-in-up pt-4 md:pt-6" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
            <button
              onClick={onStart}
              className="group relative px-8 py-4 md:px-10 md:py-5 bg-terracotta text-white font-semibold text-lg md:text-xl rounded-full overflow-hidden shadow-[0_8px_30px_rgba(196,98,45,0.3)] hover:shadow-[0_8px_40px_rgba(196,98,45,0.45)] transition-all duration-300 hover:-translate-y-1 active:translate-y-0"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 ease-in-out" />
              <span className="relative flex items-center gap-3">
                Try Gullak
                <svg 
                  className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:translate-x-1.5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Branding - Always at bottom */}
      <div className="relative z-10 flex justify-center pb-2 animate-fade-in-up" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
        <p className="text-sm font-medium text-muted/80 flex items-center gap-1.5">
          Built with <span className="font-bold tracking-wide" style={{ color: '#B080FF' }}>Kiro</span>
        </p>
      </div>
    </div>
  )
}
