import { useState } from 'react'

export default function WhatsAppWarnButton({ phone, displayName, size = 'sm' }: { phone: string | null; displayName: string; size?: 'sm'|'md' }){
  const [open, setOpen] = useState(false)
  const cleanNumber = (phone || '').replace(/\D/g, '')
  const disabled = !cleanNumber
  const prefill = `Hola ${displayName}, te escribo desde AgroLink.`
  const waHref = cleanNumber ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(prefill)}` : '#'
  const btnClass = size === 'md'
    ? `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`
    : `inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`
  const iconSize = size === 'md' ? 'text-[20px]' : 'text-[18px]'
  return (
    <>
      <button
        type="button"
        onClick={()=> !disabled && setOpen(true)}
        className={btnClass}
        title={disabled ? 'Este contacto no tiene número disponible' : 'Chatear por WhatsApp'}
        aria-disabled={disabled}
      >
        <span className={`material-icons-outlined ${iconSize} text-green-600`}>whatsapp</span>
        WhatsApp
      </button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-amber-600">warning</span>
              <h3 className="text-base font-semibold text-gray-900">Advertencia</h3>
            </div>
            <p className="mt-2 text-sm text-gray-700">
              Si sales de la aplicación para hablar en WhatsApp, podrías ser víctima de estafas u otros problemas en internet.
              Verifica la identidad de la persona y nunca compartas datos sensibles.
            </p>
            <p className="mt-2 text-sm text-gray-700">Número: <span className="font-mono">{cleanNumber || 'No disponible'}</span></p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={()=> setOpen(false)} className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={()=> setOpen(false)} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                Continuar a WhatsApp
                <span className="material-icons-outlined text-[18px]">open_in_new</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
