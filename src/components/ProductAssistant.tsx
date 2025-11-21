import { useState } from 'react'
import { apiFetch } from '../services/apiClient'

type Props = {
  context: {
    name?: string
    category?: string
    quantity?: string
    condition?: string
    location?: string
  }
  onUseDescription: (text: string) => void
  onUsePrice: (p: { unit?: string; kilo?: string }) => void
}

export default function ProductAssistant({ context, onUseDescription, onUsePrice }: Props) {
  const [loadingDesc, setLoadingDesc] = useState(false)
  const [descSuggestion, setDescSuggestion] = useState<string | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [priceSuggestion, setPriceSuggestion] = useState<{ unit?: string; kilo?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const makePrompt = () => {
    const parts: string[] = []
    if (context.name) parts.push(`Producto: ${context.name}`)
    if (context.category) parts.push(`Categoría: ${context.category}`)
    if (context.quantity) parts.push(`Cantidad: ${context.quantity}`)
    if (context.condition) parts.push(`Tipo: ${context.condition}`)
    if (context.location) parts.push(`Ubicación: ${context.location}`)
    return parts.join('\n')
  }

  const suggestDescription = async () => {
    setLoadingDesc(true); setError(null)
    try {
      const prompt = `${makePrompt()}\nGenera una descripción breve en español (máximo 200 caracteres) resaltando calidad y uso, sin emojis.`
      const res = await apiFetch('/api/v1/ai/deepseek/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const data = await res.json()
      const text = (data && data.output_text) ? String(data.output_text) : ''
      setDescSuggestion(text.trim())
    } catch (e: any) { setError(e?.message || 'No se pudo generar la sugerencia') } finally { setLoadingDesc(false) }
  }

  const suggestPrice = async () => {
    setLoadingPrice(true); setError(null)
    try {
      const prompt = `${makePrompt()}\nPropón precios en COP. Responde en JSON con claves price_per_unit y price_per_kilo con números enteros.`
      const res = await apiFetch('/api/v1/ai/deepseek/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const data = await res.json()
      let payload = String((data && data.output_text) ? data.output_text : '')
      let unit: string | undefined
      let kilo: string | undefined
      try {
        const obj = JSON.parse(payload)
        unit = obj.price_per_unit ? String(obj.price_per_unit) : undefined
        kilo = obj.price_per_kilo ? String(obj.price_per_kilo) : undefined
      } catch {
        const u = payload.match(/price[_\s]*per[_\s]*unit\s*[:=]\s*(\d+)/i)
        const k = payload.match(/price[_\s]*per[_\s]*kilo\s*[:=]\s*(\d+)/i)
        unit = u ? u[1] : undefined
        kilo = k ? k[1] : undefined
      }
      setPriceSuggestion({ unit, kilo })
    } catch (e: any) { setError(e?.message || 'No se pudo estimar el precio') } finally { setLoadingPrice(false) }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-green-100 bg-green-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Asistente de publicación</span>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      <div className="flex gap-2">
        <button onClick={suggestDescription} disabled={loadingDesc} type="button" className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60">
          {loadingDesc ? 'Generando…' : 'Sugerir descripción'}
        </button>
        <button onClick={suggestPrice} disabled={loadingPrice} type="button" className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60">
          {loadingPrice ? 'Calculando…' : 'Sugerir precio'}
        </button>
      </div>
      {descSuggestion && (
        <div className="rounded-md border border-green-200 bg-white p-2 text-sm text-gray-800">
          <div className="flex items-center justify-between">
            <span className="font-medium">Descripción sugerida</span>
            <button type="button" onClick={()=> onUseDescription(descSuggestion || '')} className="rounded-md border px-2 py-1 text-xs text-green-700 hover:bg-green-50">Usar</button>
          </div>
          <p className="mt-1">{descSuggestion}</p>
        </div>
      )}
      {priceSuggestion && (priceSuggestion.unit || priceSuggestion.kilo) && (
        <div className="rounded-md border border-green-200 bg-white p-2 text-sm text-gray-800">
          <div className="flex items-center justify-between">
            <span className="font-medium">Precios sugeridos</span>
            <button type="button" onClick={()=> onUsePrice({ unit: priceSuggestion?.unit, kilo: priceSuggestion?.kilo })} className="rounded-md border px-2 py-1 text-xs text-green-700 hover:bg-green-50">Aplicar</button>
          </div>
          <div className="mt-1 space-y-1">
            {priceSuggestion.unit && <p>Unidad: {priceSuggestion.unit} COP</p>}
            {priceSuggestion.kilo && <p>Kilo: {priceSuggestion.kilo} COP</p>}
          </div>
        </div>
      )}
      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
        <p>Consejo de fotos: luz natural, fondo neutro, enfoque claro y varias perspectivas.</p>
      </div>
    </div>
  )
}