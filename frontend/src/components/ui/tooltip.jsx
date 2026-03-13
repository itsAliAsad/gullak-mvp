import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export function TooltipProvider({ delayDuration = 120, ...props }) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

export function Tooltip({ ...props }) {
  return <TooltipPrimitive.Root {...props} />
}

export function TooltipTrigger({ ...props }) {
  return <TooltipPrimitive.Trigger {...props} />
}

export function TooltipContent({ className, sideOffset = 10, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-[260px] overflow-hidden rounded-xl border border-terracotta/20 bg-white/95 px-3 py-2 text-xs leading-relaxed text-brown shadow-[0_18px_40px_-24px_rgba(69,38,26,0.55)] backdrop-blur-sm',
          'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}