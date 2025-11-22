import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { aiService, type AIChatResponse } from '../services/aiService'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIChatProps {
  className?: string
  title?: string
  placeholder?: string
  maxHeight?: string
  suggestedQuestions?: string[]
}

export function AIChat({ 
  className = '', 
  title = 'Asistente Agrícola AI',
  placeholder = 'Pregúntame sobre agricultura, cultivos, técnicas...',
  maxHeight = '400px',
  suggestedQuestions = []
}: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    const newMessage: Message = {
      id: generateId(),
      role,
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setError(null)
    addMessage('user', userMessage)
    setIsLoading(true)

    try {
      const response: AIChatResponse = await aiService.chat({ prompt: userMessage })
      addMessage('assistant', response.output_text)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      addMessage('assistant', `Lo siento, tuve un problema para responder: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setInput(question)
    inputRef.current?.focus()
  }

  const handleClearChat = () => {
    setMessages([])
    setError(null)
    inputRef.current?.focus()
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className={`bg-white rounded-xl border border-green-100 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-green-600 rounded-lg">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-600">Powered by DeepSeek AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Limpiar conversación"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">IA</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ maxHeight }}
      >
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 bg-green-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Bot className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">¡Hola! Soy tu asistente agrícola</h4>
            <p className="text-sm text-gray-600 mb-4">
              Puedo ayudarte con preguntas sobre agricultura, cultivos, técnicas de siembra, manejo de plagas, y más.
            </p>
            
            {/* Suggested questions */}
            {suggestedQuestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">Preguntas sugeridas:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.slice(0, 4).map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-green-600 rounded-lg">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
                
                <div className={`max-w-[80%] ${message.role === 'user' ? 'order-1' : ''}`}>
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-green-600 text-white rounded-br-lg'
                        : 'bg-gray-100 text-gray-900 rounded-bl-lg'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p className={`text-xs text-gray-500 mt-1 ${
                    message.role === 'user' ? 'text-right' : ''
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 order-2">
                    <div className="p-2 bg-gray-600 rounded-lg">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-green-600 rounded-lg">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-2xl rounded-bl-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Escribiendo...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-green-100">
        <div className="flex gap-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              disabled={isLoading}
              rows={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Presiona Enter para enviar, Shift+Enter para nueva línea
        </p>
      </form>
    </div>
  )
}