import { cn } from '@/lib/utils'

export function GullakScoreBadge({ score, size = 'md' }) {
  const color =
    score >= 8 ? 'bg-terracotta text-white' :
    score >= 6 ? 'bg-terracotta-light text-terracotta' :
    'bg-sand text-brown'

  return (
    <div className={cn(
      'rounded-full font-bold flex items-center justify-center shrink-0',
      color,
      size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm'
    )}>
      {score.toFixed(1)}
    </div>
  )
}
