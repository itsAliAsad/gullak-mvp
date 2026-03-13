const TEAM_MEMBERS = [
  {
    name: 'Muhammad Ali Asad',
    role: 'AI and Full-Stack Engineer',
    initials: 'MA',
    accent: 'from-[#f3dfcf] via-[#fff8f2] to-[#ead2bf]',
    summary:
      'Muhammad Ali Asad brings the systems layer to MarketByte: AI orchestration, backend logic, and product engineering shaped by a LUMS foundation in Economics, Mathematics, and Computer Science. His strength is turning complex theory into fast, production-ready software under hackathon timelines.',
  },
  {
    name: 'Arsalan Ashaar Hashmi',
    role: 'Data Engineering and AI',
    initials: 'AH',
    accent: 'from-[#e7dcc9] via-[#fffaf5] to-[#d8c2a2]',
    summary:
      'Arsalan Ashaar Hashmi drives the data and analytics spine of the project. As a LUMS Computer Science undergraduate focused on data engineering, artificial intelligence, and macro-level analytics, he helps turn messy financial information into decision-ready intelligence.',
  },
]

function PortraitPlaceholder({ initials, accent }) {
  return (
    <div className={`relative aspect-[4/5] overflow-hidden rounded-[24px] border border-sand bg-gradient-to-br ${accent}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(196,98,45,0.16),_transparent_48%)]" />
      <div className="absolute inset-x-6 top-6 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta backdrop-blur-sm">
        Image Placeholder
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-terracotta/20 bg-white/75 text-3xl font-bold text-terracotta shadow-sm">
          {initials}
        </div>
        <p className="max-w-[14rem] text-sm leading-relaxed text-brown/70">
          Drop in a founder headshot here before final demo or submission.
        </p>
      </div>
    </div>
  )
}

function MemberCard({ member }) {
  return (
    <article className="grid gap-6 rounded-[28px] border border-sand bg-white p-5 shadow-[0_26px_60px_-34px_rgba(69,38,26,0.35)] md:grid-cols-[260px_minmax(0,1fr)] md:p-6">
      <PortraitPlaceholder initials={member.initials} accent={member.accent} />
      <div className="flex flex-col justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-terracotta">
            Team MarketByte
          </p>
          <h2 className="text-2xl font-bold text-brown leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            {member.name}
          </h2>
          <p className="mt-2 text-sm font-medium text-muted">
            {member.role}
          </p>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-brown/80 md:text-[15px]">
            {member.summary}
          </p>
        </div>
      </div>
    </article>
  )
}

export function Team() {
  return (
    <div className="h-full overflow-y-auto bg-cream">
      <section className="border-b border-sand bg-[linear-gradient(180deg,#fffaf6_0%,#f8ede1_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-18 md:py-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-terracotta">
            AWS AI Hackathon 2026
          </p>
          <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.7fr)] md:items-end">
            <div>
              <h1 className="max-w-3xl text-4xl font-bold leading-tight text-brown md:text-5xl" style={{ fontFamily: 'Georgia, serif' }}>
                We built MarketByte to show how AI can make fund analysis usable, explainable, and fast.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-muted">
                This is a two-person build focused on a narrow problem with real stakes: making Pakistan's mutual fund market easier to understand through strong data pipelines, agentic AI, and interfaces that do not collapse into jargon.
              </p>
            </div>
            <div className="rounded-[24px] border border-terracotta/15 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-terracotta">
                Hackathon Focus
              </p>
              <p className="mt-3 text-sm leading-7 text-brown/80">
                Bedrock-powered agent workflows. Reliable financial data engineering. A recommendation experience that can justify itself clearly in front of judges and users.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <div className="space-y-6">
          {TEAM_MEMBERS.map((member) => (
            <MemberCard key={member.name} member={member} />
          ))}
        </div>
      </section>
    </div>
  )
}
