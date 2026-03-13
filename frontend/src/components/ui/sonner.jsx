import { Toaster as Sonner } from 'sonner'

export function Toaster(props) {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            'group flex items-start gap-3 bg-white border border-sand shadow-lg rounded-2xl px-4 py-3 text-brown',
          title:   'text-sm font-semibold text-brown',
          description: 'text-xs text-muted leading-snug',
          success: 'border-green-200',
          error:   'border-red-200',
          closeButton: 'text-muted/50 hover:text-muted',
        },
      }}
      {...props}
    />
  )
}
