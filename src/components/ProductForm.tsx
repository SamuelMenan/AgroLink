import { useState } from 'react'
import ImageUploader from './ImageUploader'
import { PRODUCT_CATEGORIES } from '../types/product'

export type ProductFormValues = {
  name: string
  description: string
  price: string
  quantity: string
  category: string
  images: File[]
  location?: string
  lat?: number
  lng?: number
  existing_image_urls?: string[]
}

export type ProductFormProps = {
  title: string
  initial?: Partial<ProductFormValues>
  onSubmit: (values: ProductFormValues) => Promise<void>
  submitLabel?: string
  existingImages?: string[]
}

const initialValues: ProductFormValues = {
  name: '', description: '', price: '', quantity: '', category: PRODUCT_CATEGORIES[0], images: [], location: '',
}

export default function ProductForm({ title, initial, onSubmit, submitLabel = 'Publicar', existingImages = [] }: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>({ ...initialValues, ...initial, existing_image_urls: existingImages })
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  function validate(): boolean {
    const e: Partial<Record<keyof ProductFormValues, string>> = {}
    if (!values.name.trim()) e.name = 'El nombre del producto es obligatorio.'
    if (!values.description.trim()) e.description = 'Describe brevemente tu producto.'
    if (values.description.trim().length > 200) e.description = 'Máximo 200 caracteres.'
    const priceNum = Number(values.price)
    if (!values.price || Number.isNaN(priceNum) || priceNum <= 0) e.price = 'Precio numérico y mayor a 0.'
    const qtyNum = Number(values.quantity)
    if (!values.quantity || Number.isNaN(qtyNum) || qtyNum < 0) e.quantity = 'Cantidad numérica.'
    if (!values.category) e.category = 'Selecciona una categoría.'
    const existingCount = values.existing_image_urls?.length || 0
    const newCount = values.images?.length || 0
    if (existingCount + newCount < 1) e.images = 'Agrega al menos una imagen.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInfo(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      await onSubmit(values)
      setInfo('Producto publicado con éxito')
      setValues(initialValues)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-lg">
      <div className="border-b border-gray-100 p-6 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-green-800">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">Completa los campos para publicar tu producto.</p>
      </div>
      <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre del producto</label>
          <input value={values.name} onChange={(e)=>setValues(v=>({...v,name:e.target.value}))} className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Descripción breve</label>
          <textarea value={values.description} onChange={(e)=>setValues(v=>({...v,description:e.target.value}))} rows={3} className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          <p className="mt-1 text-xs text-gray-500">Máx. 200 caracteres</p>
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Precio (COP)</label>
            <input value={values.price} onChange={(e)=>setValues(v=>({...v,price:e.target.value}))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
            {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cantidad disponible</label>
            <input value={values.quantity} onChange={(e)=>setValues(v=>({...v,quantity:e.target.value}))} inputMode="numeric" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
            {errors.quantity && <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Categoría</label>
          <select value={values.category} onChange={(e)=>setValues(v=>({...v,category:e.target.value}))} className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20">
            {PRODUCT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Ubicación (ciudad/municipio)</label>
          <div className="mt-1 flex gap-2">
            <input value={values.location || ''} onChange={(e)=>setValues(v=>({...v,location:e.target.value}))} placeholder="Ej: Medellín, Antioquia" className="w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
            <button type="button" onClick={()=>{
              if (!navigator.geolocation) return
              navigator.geolocation.getCurrentPosition((pos)=>{
                setValues(v=>({...v, lat: pos.coords.latitude, lng: pos.coords.longitude}))
              })
            }} className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Usar mi ubicación</button>
          </div>
          {values.lat!=null && values.lng!=null && (
            <p className="mt-1 text-xs text-gray-500">Coordenadas guardadas</p>
          )}
        </div>
        <div>
          <ImageUploader onChange={(files)=>setValues(v=>({...v,images:files}))} />
          {errors.images && <p className="mt-1 text-sm text-red-600">{errors.images}</p>}
        </div>
        {values.existing_image_urls && values.existing_image_urls.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Imágenes existentes</label>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {values.existing_image_urls.map((url, idx) => (
                <div key={url+idx} className="relative overflow-hidden rounded-lg border">
                  <img src={url} alt={`img-${idx}`} className="h-28 w-full object-cover" />
                  <button type="button" onClick={()=>setValues(v=>({...v, existing_image_urls: (v.existing_image_urls||[]).filter(u=>u!==url)}))} className="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-0.5 text-xs font-semibold text-red-600 shadow hover:bg-white">Eliminar</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {info && <p className="text-sm text-green-700">{info}</p>}
        <button disabled={submitting} className="w-full rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white shadow transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
          {submitLabel}
        </button>
      </form>
    </div>
  )
}
