import { useState } from 'react'
import { createPortal } from 'react-dom'

interface MessageSellerModalProps {
  isOpen: boolean
  onClose: () => void
  sellerName: string
  productName: string
  onSendMessage: (message: string) => Promise<void>
}

export function MessageSellerModal({ 
  isOpen, 
  onClose, 
  onSendMessage 
}: MessageSellerModalProps) {
  const [message, setMessage] = useState(`Hola, Eli. ¿Sigue disponible?`)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setIsSending(true)
    setError(null)

    try {
      await onSendMessage(message.trim())
      setMessage('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el mensaje')
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = () => {
    setMessage(`Hola, Eli. ¿Sigue disponible?`)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        onClick={handleClose}
      />
      
      {/* Modal - Dark Theme with rounded corners like Facebook */}
      <div className="relative bg-[#242526] rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header with blue Messenger icon */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-700">
          {/* Messenger icon */}
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.905 1.463 5.499 3.75 7.189V22l3.427-1.88c.915.253 1.856.38 2.823.38 5.523 0 10-4.145 10-9.257S17.523 2 12 2zm.995 12.468l-2.567-2.736-5.01 2.736 5.51-5.844 2.628 2.736 4.949-2.736-5.51 5.844z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-100">
              Envía un mensaje al vendedor
            </h3>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hola, ¿sigue disponible?"
              rows={4}
              className="w-full px-4 py-3 bg-[#3A3B3C] border border-gray-600 rounded-xl text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-none text-sm leading-relaxed"
              disabled={isSending}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Footer - Full width button */}
          <button
            type="submit"
            disabled={!message.trim() || isSending}
            className="w-full py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar'
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}