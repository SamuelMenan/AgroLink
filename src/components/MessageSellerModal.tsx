import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Send } from 'lucide-react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal - Dark Theme */}
      <div className="relative bg-gray-900 rounded-xl shadow-xl max-w-md w-full border border-gray-700">
        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          {/* Messenger-style blue circle icon */}
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.905 1.463 5.499 3.75 7.189V22l3.427-1.88c.915.253 1.856.38 2.823.38 5.523 0 10-4.145 10-9.257S17.523 2 12 2zm.995 12.468l-2.567-2.736-5.01 2.736 5.51-5.844 2.628 2.736 4.949-2.736-5.51 5.844z"/>
            </svg>
          </div>
          <h3 className="text-base font-medium text-gray-100">
            Envía un mensaje al vendedor
          </h3>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 pt-0">
          <div className="mb-4">
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
              disabled={isSending}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Footer - Full width button */}
          <button
            type="submit"
            disabled={!message.trim() || isSending}
            className="w-full py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar
              </>
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}