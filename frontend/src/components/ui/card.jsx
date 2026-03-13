import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-xl border border-sand bg-white shadow-sm', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }) {
  return <div className={cn('p-5 pb-3', className)} {...props}>{children}</div>
}

export function CardContent({ className, children, ...props }) {
  return <div className={cn('px-5 pb-5', className)} {...props}>{children}</div>
}
