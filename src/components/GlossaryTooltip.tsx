import { useState } from 'react'
import { Info } from 'lucide-react'
import { findGlossaryTerm } from '../utils/agriculturalGlossary'

interface GlossaryTooltipProps {
  text: string
  className?: string
}

export function GlossaryTooltip({ text, className = '' }: GlossaryTooltipProps) {
  const [isHovered, setIsHovered] = useState(false)
  const term = findGlossaryTerm(text)
  
  if (!term) return null
  
  return (
    <div className={`relative inline-block ${className}`}>
      <Info 
        className="h-4 w-4 text-green-600 cursor-help"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      
      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-10">
          <div className="font-semibold mb-1">{term.term}</div>
          <div className="text-gray-300">{term.definition}</div>
          <div className="mt-2 text-xs text-gray-400 capitalize">{term.category}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}

export function AgriculturalTerm({ term, children }: { term: string, children: React.ReactNode }) {
  const glossaryTerm = findGlossaryTerm(term)
  
  if (!glossaryTerm) return <>{children}</>
  
  return (
    <span className="relative group">
      {children}
      <GlossaryTooltip text={term} className="ml-1" />
    </span>
  )
}