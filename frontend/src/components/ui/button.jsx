import { cn } from '@/lib/utils'

export function Button({ className, variant = 'default', size = 'md', disabled, children, ...props }) {
  return (
    <button
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-terracotta text-white hover:bg-terracotta/90': variant === 'default',
          'border border-sand bg-transparent text-brown hover:bg-sand/50': variant === 'outline',
          'bg-transparent text-muted hover:text-brown hover:bg-sand/30': variant === 'ghost',
          'bg-sand text-brown hover:bg-sand/70': variant === 'secondary',
        },
        {
          'h-9 px-4 text-sm': size === 'sm',
          'h-11 px-6 text-base': size === 'md',
          'h-13 px-8 text-lg': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
