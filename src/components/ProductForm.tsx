import { useState, useEffect } from 'react'
import ImageUploader from './ImageUploader'
import RichTextEditor from './RichTextEditor'
import ProductPreview from './ProductPreview'
import { PRODUCT_CATEGORIES } from '../types/product'
import { DEPARTMENTS } from '../services/locationService'
import { validateProductForm } from '../utils/validation'
import { ValidatedInput, ValidatedTextArea } from '../hooks/useValidation.tsx'
import { VALIDATION_RULES } from '../utils/inputValidation'
import { formatAgriculturalQuantity } from '../utils/agriculturalUnits'
import { AgriculturalTerm } from './GlossaryTooltip'
import ProductAssistant from './ProductAssistant'

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
  // New fields
  pricePerUnit?: string
  pricePerKilo?: string
  department?: string
  municipality?: string
  detailedDescription?: string
  condition?: 'fresh' | 'organic' | 'conventional'
  stockAvailable?: boolean
}

export type ProductFormProps = {
  title: string
  initial?: Partial<ProductFormValues>
  onSubmit: (values: ProductFormValues) => Promise<void>
  submitLabel?: string
  existingImages?: string[]
}

const initialValues: ProductFormValues = {
  name: '', 
  description: '', 
  price: '', 
  quantity: '', 
  category: PRODUCT_CATEGORIES[0], 
  images: [], 
  location: '',
  pricePerUnit: '',
  pricePerKilo: '',
  department: '',
  municipality: '',
  detailedDescription: '',
  condition: 'fresh',
  stockAvailable: true,
}

export default function ProductForm({ title, initial, onSubmit, submitLabel = 'Publicar', existingImages = [] }: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>({ ...initialValues, ...initial, existing_image_urls: existingImages })
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Update location when municipality or department changes
  useEffect(() => {
    if (values.department && values.municipality) {
      const department = DEPARTMENTS.find(d => d.id === values.department)
      const locationString = `${values.municipality}, ${department?.name || ''}`
      setValues(v => ({ ...v, location: locationString }))
    }
  }, [values.department, values.municipality])

  function validate(): boolean {
    const validationErrors = validateProductForm(values)
    setErrors(validationErrors)
    return Object.keys(validationErrors).length === 0
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

  const handleInputChange = (field: keyof ProductFormValues, value: string | boolean | File[]) => {
    setValues(v => ({ ...v, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(e => ({ ...e, [field]: undefined }))
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
          <ValidatedInput
            value={values.name}
            onChange={(value) => handleInputChange('name', value)}
            rule={VALIDATION_RULES.productName}
            placeholder="Ej: Café de especialidad, Arroz orgánico, Plátano verde"
            className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            showIcon={true}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Descripción breve</label>
          <ValidatedTextArea
            value={values.description} 
            onChange={(value) => handleInputChange('description', value)}
            rule={VALIDATION_RULES.productDescription}
            rows={3}
            maxLength={200}
            placeholder="Describe brevemente tu producto agrícola..."
            className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            showIcon={true}
          />
          <p className="mt-1 text-xs text-gray-500">Máx. 200 caracteres</p>
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
          <ProductAssistant
            context={{ name: values.name, category: values.category, quantity: values.quantity, condition: values.condition, location: values.location }}
            onUseDescription={(text)=> handleInputChange('description', text)}
            onUsePrice={(p)=> {
              if (p.unit) handleInputChange('pricePerUnit', p.unit)
              if (p.kilo) handleInputChange('pricePerKilo', p.kilo)
            }}
          />
        </div>

        {/* Detailed Description with Rich Text Editor */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Descripción detallada (opcional)</label>
          <RichTextEditor
            value={values.detailedDescription || ''}
            onChange={(value) => handleInputChange('detailedDescription', value)}
            placeholder="Describe tu producto con más detalle..."
            maxLength={2000}
            className="mt-1"
          />
        </div>
        {/* Price Fields */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Precios (al menos uno es obligatorio)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Precio por unidad (COP)</label>
              <ValidatedInput
                value={values.pricePerUnit || ''} 
                onChange={(value) => handleInputChange('pricePerUnit', value)}
                rule={VALIDATION_RULES.price}
                inputMode="decimal" 
                placeholder="Ej: 500"
                className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                showIcon={true}
              />
              {errors.pricePerUnit && <p className="mt-1 text-sm text-red-600">{errors.pricePerUnit}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Precio por kilo (COP)</label>
              <ValidatedInput
                value={values.pricePerKilo || ''} 
                onChange={(value) => handleInputChange('pricePerKilo', value)}
                rule={VALIDATION_RULES.price}
                inputMode="decimal" 
                placeholder="Ej: 3500"
                className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                showIcon={true}
              />
              {errors.pricePerKilo && <p className="mt-1 text-sm text-red-600">{errors.pricePerKilo}</p>}
            </div>
          </div>
          {/* Legacy price field for backward compatibility */}
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700">Precio general (COP) - Opcional</label>
            <ValidatedInput
              value={values.price || ''} 
              onChange={(value) => handleInputChange('price', value)}
              rule={VALIDATION_RULES.price}
              inputMode="decimal" 
              placeholder="Ej: 1000"
              className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
              showIcon={true}
            />
            {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Cantidad disponible</label>
            <ValidatedInput
              value={values.quantity} 
              onChange={(value) => handleInputChange('quantity', value)}
              rule={VALIDATION_RULES.quantity}
              inputMode="numeric" 
              placeholder="Ej: 100, 5 fanegas, 20 arrobas"
              className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
              showIcon={true}
            />
            <p className="mt-1 text-xs text-gray-500">Puedes usar unidades agrícolas: fanegas, arrobas, etc.</p>
            {errors.quantity && <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>}
            {/* Unit conversion display */}
            {values.quantity && (
              <div className="mt-2 p-2 bg-blue-50 rounded-md text-xs text-blue-700">
                <p className="font-medium">Conversión de unidades:</p>
                <p>{formatAgriculturalQuantity(values.quantity)}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tipo de cultivo
              <AgriculturalTerm term="cultivo">
                <span className="ml-1 text-xs text-green-600 cursor-help">¿Qué es?</span>
              </AgriculturalTerm>
            </label>
            <select 
              value={values.condition || 'fresh'} 
              onChange={(e) => handleInputChange('condition', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            >
              <option value="fresh">Fresco (recién cosechado)</option>
              <option value="organic">
                Orgánico certificado
                <AgriculturalTerm term="orgánico">
                  <span className="ml-1 text-xs text-green-600">ℹ</span>
                </AgriculturalTerm>
              </option>
              <option value="conventional">Convencional</option>
            </select>
            {errors.condition && <p className="mt-1 text-sm text-red-600">{errors.condition}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Categoría</label>
          <select 
            value={values.category} 
            onChange={(e) => handleInputChange('category', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          >
            {PRODUCT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
        </div>

        {/* Stock Availability Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="text-sm font-medium text-gray-700">Disponibilidad de stock</label>
            <p className="text-xs text-gray-500">Indica si el producto está disponible para la venta</p>
          </div>
          <button
            type="button"
            onClick={() => handleInputChange('stockAvailable', !values.stockAvailable)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              values.stockAvailable ? 'bg-green-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                values.stockAvailable ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {/* Location Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Departamento</label>
            <select 
              value={values.department || ''} 
              onChange={(e) => handleInputChange('department', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            >
              <option value="">Selecciona un departamento</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            {errors.department && <p className="mt-1 text-sm text-red-600">{errors.department}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Municipio</label>
            <ValidatedInput
              value={values.municipality || ''}
              onChange={(value) => handleInputChange('municipality', value)}
              rule={VALIDATION_RULES.location}
              placeholder="Ej: Armenia, Pereira, Manizales"
              className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
              showIcon={true}
            />
            <p className="mt-1 text-xs text-gray-500">Escribe el nombre del municipio donde se encuentra tu producto</p>
            {errors.municipality && <p className="mt-1 text-sm text-red-600">{errors.municipality}</p>}
          </div>
          
          {/* Legacy location field for backward compatibility */}
          <div className="hidden">
            <input 
              value={`${values.municipality || ''}${values.department ? ', ' + DEPARTMENTS.find(d => d.id === values.department)?.name : ''}`} 
              onChange={(e) => handleInputChange('location', e.target.value)}
            />
          </div>
        </div>
        {/* Enhanced Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Imágenes del producto</label>
          <ImageUploader onChange={(files) => handleInputChange('images', files)} />
          <p className="mt-1 text-xs text-gray-500">Puedes subir múltiples imágenes. Selecciona hasta 5 imágenes.</p>
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
        <div className="flex gap-3">
          <button 
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={submitting}
            className="flex-1 rounded-lg border border-green-600 bg-white px-4 py-2.5 font-semibold text-green-600 shadow transition-all hover:-translate-y-0.5 hover:bg-green-50 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Vista previa
          </button>
          <button 
            type="submit" 
            disabled={submitting} 
            className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white shadow transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </div>
        {info && <p className="text-sm text-green-700">{info}</p>}
        
        {/* Preview Modal */}
        {showPreview && (
          <ProductPreview 
            formData={values}
            onClose={() => setShowPreview(false)}
          />
        )}
      </form>
    </div>
  )
}
