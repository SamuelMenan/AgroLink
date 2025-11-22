import { useState, useRef, useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
}

export default function RichTextEditor({ value, onChange, maxLength, className = '', placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const handleFormat = (command: string) => {
    document.execCommand(command, false)
    editorRef.current?.focus()
    updateToolbarState()
  }

  const updateToolbarState = () => {
    setIsBold(document.queryCommandState('bold'))
    setIsItalic(document.queryCommandState('italic'))
    setIsUnderline(document.queryCommandState('underline'))
  }

  const handleInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML
      if (maxLength && content.length > maxLength) {
        editorRef.current.innerHTML = content.substring(0, maxLength)
        return
      }
      onChange(content)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault()
          handleFormat('bold')
          break
        case 'i':
          e.preventDefault()
          handleFormat('italic')
          break
        case 'u':
          e.preventDefault()
          handleFormat('underline')
          break
      }
    }
  }

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => handleFormat('bold')}
          className={`p-2 rounded transition-colors ${
            isBold ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="Negrita (Ctrl+B)"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 4a2 2 0 00-2 2v8a2 2 0 002 2h5.5a3.5 3.5 0 001.852-6.49A3.5 3.5 0 0011.5 4H6zm2 2h3.5a1.5 1.5 0 010 3H8V6zm0 5h4.5a1.5 1.5 0 010 3H8v-3z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleFormat('italic')}
          className={`p-2 rounded transition-colors ${
            isItalic ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="Cursiva (Ctrl+I)"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 4a1 1 0 011-1h2a1 1 0 110 2h-1.382l-2 8H10a1 1 0 110 2H8a1 1 0 01-1-1h1.618l2-8H8a1 1 0 01-1-1z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleFormat('underline')}
          className={`p-2 rounded transition-colors ${
            isUnderline ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="Subrayado (Ctrl+U)"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 4a4 4 0 00-4 4v4a4 4 0 108 0V8a4 4 0 00-4-4zM5 16h10v1H5v-1z" />
          </svg>
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => handleFormat('insertUnorderedList')}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded transition-colors"
          title="Lista con viñetas"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 9h10v1H7V9zm0-4h10v1H7V5zm0 8h10v1H7v-1zM3 5h1v1H3V5zm0 4h1v1H3V9zm0 4h1v1H3v-1z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleFormat('insertOrderedList')}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded transition-colors"
          title="Lista numerada"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 9h10v1H7V9zm0-4h10v1H7V5zm0 8h10v1H7v-1zM3 5h1v1H3V5zm0 4h1v1H3V9zm0 4h1v1H3v-1z" />
          </svg>
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={updateToolbarState}
        onKeyUp={updateToolbarState}
        className="min-h-[120px] p-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        dangerouslySetInnerHTML={{ __html: value }}
        style={{ 
          lineHeight: '1.5',
          fontSize: '14px',
          direction: 'ltr',
          textAlign: 'left',
          unicodeBidi: 'plaintext',
          whiteSpace: 'pre-wrap'
        }}
        aria-placeholder={placeholder || ''}
      />
      {maxLength && (
        <div className="p-2 text-xs text-gray-500 border-t border-gray-200 bg-gray-50">
          {value.replace(/<[^>]*>/g, '').length}/{maxLength} caracteres
        </div>
      )}
    </div>
  )
}
