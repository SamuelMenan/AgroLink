import { useState } from 'react'
import type { ProductFormValues } from './ProductForm'

interface ProductPreviewProps {
  formData: ProductFormValues
  onClose: () => void
}

export default function ProductPreview({ formData, onClose }: ProductPreviewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const allImages = [
    ...(formData.existing_image_urls || []),
    ...formData.images.map(file => URL.createObjectURL(file))
  ]

  const formatPrice = (price: string) => {
    const num = Number(price)
    return isNaN(num) ? '0' : num.toLocaleString('es-CO')
  }

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'new': return 'Nuevo'
      case 'used': return 'Usado'
      case 'seasonal': return 'De temporada'
      default: return 'Sin especificar'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Vista previa del producto</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Image Gallery */}
          {allImages.length > 0 && (
            <div className="mb-6">
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
                <img
                  src={allImages[currentImageIndex]}
                  alt={`${formData.name} - Imagen ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : allImages.length - 1)}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex(prev => prev < allImages.length - 1 ? prev + 1 : 0)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {allImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                        index === currentImageIndex ? 'border-green-500' : 'border-gray-200'
                      }`}
                    >
                      <img src={image} alt={`Miniatura ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Product Info */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{formData.name}</h1>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                  {formData.category}
                </span>
                {formData.condition && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                    {getConditionLabel(formData.condition)}
                  </span>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formData.pricePerUnit && (
                  <div>
                    <p className="text-sm text-gray-600">Precio por unidad</p>
                    <p className="text-lg font-semibold text-gray-900">COP {formatPrice(formData.pricePerUnit)}</p>
                  </div>
                )}
                {formData.pricePerKilo && (
                  <div>
                    <p className="text-sm text-gray-600">Precio por kilo</p>
                    <p className="text-lg font-semibold text-gray-900">COP {formatPrice(formData.pricePerKilo)}</p>
                  </div>
                )}
                {formData.price && !formData.pricePerUnit && !formData.pricePerKilo && (
                  <div>
                    <p className="text-sm text-gray-600">Precio</p>
                    <p className="text-lg font-semibold text-gray-900">COP {formatPrice(formData.price)}</p>
                  </div>
                )}
              </div>
              {formData.quantity && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Cantidad disponible</p>
                  <p className="text-base font-medium text-gray-900">{formData.quantity} unidades</p>
                </div>
              )}
            </div>

            {/* Description */}
            {formData.description && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descripción breve</h3>
                <p className="text-gray-700">{formData.description}</p>
              </div>
            )}

            {/* Detailed Description */}
            {formData.detailedDescription && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descripción detallada</h3>
                <div 
                  className="text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: formData.detailedDescription }}
                />
              </div>
            )}

            {/* Location */}
            {formData.department && formData.municipality && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Ubicación</h3>
                <p className="text-blue-800">
                  {formData.municipality}, {formData.department}
                </p>
              </div>
            )}

            {/* Stock Availability */}
            {formData.stockAvailable !== undefined && (
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.stockAvailable ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className={`text-sm font-medium ${
                  formData.stockAvailable ? 'text-green-700' : 'text-red-700'
                }`}>
                  {formData.stockAvailable ? 'En stock' : 'Sin stock'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cerrar vista previa
          </button>
        </div>
      </div>
    </div>
  )
}