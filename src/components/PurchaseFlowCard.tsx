import { useState } from 'react'
import { 
  type CompraAcuerdo,
  type DeliveryMethod,
  type PaymentMethod,
  DELIVERY_METHODS,
  PAYMENT_METHODS
} from '../types/messaging'
import { Truck, CreditCard, ShoppingCart, DollarSign, Check } from 'lucide-react'

interface PurchaseFlowCardProps {
  conversationId: string
  productName: string
  productPrice: number
  onComplete: (agreement: CompraAcuerdo) => void
  onCancel: () => void
}

export function PurchaseFlowCard({ 
  conversationId, 
  productName, 
  productPrice, 
  onComplete, 
  onCancel 
}: PurchaseFlowCardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [purchaseData, setPurchaseData] = useState({
    quantity: 1,
    finalPrice: productPrice,
    deliveryMethod: 'encuentro' as DeliveryMethod,
    paymentMethod: 'contra_entrega' as PaymentMethod,
    deliveryLocation: '',
    deliveryDate: ''
  })

  const steps = [
    {
      id: 0,
      title: 'Confirmar cantidad',
      icon: ShoppingCart,
      description: '¿Cuántas unidades deseas comprar?'
    },
    {
      id: 1,
      title: 'Confirmar precio final',
      icon: DollarSign,
      description: 'Precio acordado para la compra'
    },
    {
      id: 2,
      title: 'Confirmar entrega',
      icon: Truck,
      description: '¿Cómo se realizará la entrega?'
    },
    {
      id: 3,
      title: 'Elegir forma de pago',
      icon: CreditCard,
      description: 'Método de pago preferido'
    }
  ]

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Complete the purchase agreement
      const agreement: CompraAcuerdo = {
        id: `agreement-${Date.now()}`,
        conversation_id: conversationId,
        buyer_id: 'current-user', // This would come from auth context
        seller_id: 'seller-id', // This would come from conversation
        product_id: 'product-id', // This would come from conversation
        quantity: purchaseData.quantity,
        agreed_price: purchaseData.finalPrice,
        delivery_method: purchaseData.deliveryMethod,
        payment_method: purchaseData.paymentMethod,
        status: 'pending',
        created_at: new Date().toISOString(),
        delivery_location: purchaseData.deliveryLocation,
        delivery_date: purchaseData.deliveryDate
      }
      onComplete(agreement)
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Quantity
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad de unidades:
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={purchaseData.quantity}
                onChange={(e) => setPurchaseData({
                  ...purchaseData, 
                  quantity: parseInt(e.target.value) || 1
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                Total estimado: ${(purchaseData.quantity * purchaseData.finalPrice).toLocaleString()}
              </p>
            </div>
          </div>
        )

      case 1: // Price
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio final acordado:
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchaseData.finalPrice}
                onChange={(e) => setPurchaseData({
                  ...purchaseData, 
                  finalPrice: parseFloat(e.target.value) || 0
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-green-800">
                Precio por unidad: ${purchaseData.finalPrice.toLocaleString()}
              </p>
              <p className="text-sm text-green-800 font-medium">
                Total: ${(purchaseData.quantity * purchaseData.finalPrice).toLocaleString()}
              </p>
            </div>
          </div>
        )

      case 2: // Delivery
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de entrega:
              </label>
              <select
                value={purchaseData.deliveryMethod}
                onChange={(e) => setPurchaseData({
                  ...purchaseData, 
                  deliveryMethod: e.target.value as DeliveryMethod
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {DELIVERY_METHODS.map(method => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ubicación de entrega:
              </label>
              <input
                type="text"
                value={purchaseData.deliveryLocation}
                onChange={(e) => setPurchaseData({
                  ...purchaseData, 
                  deliveryLocation: e.target.value
                })}
                placeholder="Ej: Parque principal de Pasto"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de entrega:
              </label>
              <input
                type="date"
                value={purchaseData.deliveryDate}
                onChange={(e) => setPurchaseData({
                  ...purchaseData, 
                  deliveryDate: e.target.value
                })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )

      case 3: // Payment
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forma de pago:
              </label>
              <div className="space-y-2">
                {PAYMENT_METHODS.map(method => (
                  <label key={method.value} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={purchaseData.paymentMethod === method.value}
                      onChange={(e) => setPurchaseData({
                        ...purchaseData, 
                        paymentMethod: e.target.value as PaymentMethod
                      })}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{method.label}</p>
                      <p className="text-sm text-gray-600">{method.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                💡 Consejo: Contra entrega es la forma más segura para ambas partes.
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
        <h3 className="text-lg font-semibold text-white">Proceso de Compra</h3>
        <p className="text-blue-100 text-sm">Producto: {productName}</p>
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-medium ${
                index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
              }`}>
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <div className="ml-2">
                <p className={`text-sm font-medium ${
                  index <= currentStep ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-4 ${
                  index < currentStep ? 'bg-blue-500' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              {currentStep === 0 && <ShoppingCart className="w-6 h-6 text-blue-600" />}
              {currentStep === 1 && <DollarSign className="w-6 h-6 text-blue-600" />}
              {currentStep === 2 && <Truck className="w-6 h-6 text-blue-600" />}
              {currentStep === 3 && <CreditCard className="w-6 h-6 text-blue-600" />}
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">
                {steps[currentStep].title}
              </h4>
              <p className="text-sm text-gray-600">
                {steps[currentStep].description}
              </p>
            </div>
          </div>
          
          {renderStepContent()}
        </div>

        {/* Summary */}
        {currentStep === 3 && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h5 className="font-medium text-gray-800 mb-3">Resumen del acuerdo:</h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Cantidad:</span>
                <span className="font-medium">{purchaseData.quantity} unidades</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Precio final:</span>
                <span className="font-medium">${purchaseData.finalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-bold">${(purchaseData.quantity * purchaseData.finalPrice).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Entrega:</span>
                <span className="font-medium">
                  {DELIVERY_METHODS.find(d => d.value === purchaseData.deliveryMethod)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pago:</span>
                <span className="font-medium">
                  {PAYMENT_METHODS.find(p => p.value === purchaseData.paymentMethod)?.label}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={handlePreviousStep}
            disabled={currentStep === 0}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            
            <button
              onClick={handleNextStep}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              {currentStep === steps.length - 1 ? 'Confirmar compra' : 'Siguiente'}
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}