import { cn } from '@/lib/utils'

export function Badge({ className, variant = 'default', children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-terracotta text-white': variant === 'default',
          'bg-terracotta-light text-terracotta': variant === 'outline',
          'bg-sand text-brown': variant === 'secondary',
          'bg-green-100 text-green-800': variant === 'success',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
