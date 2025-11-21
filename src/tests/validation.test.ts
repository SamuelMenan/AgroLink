import { describe, it, expect } from 'vitest'
import { validateProductForm } from '../utils/validation'
import type { ProductFormValues } from '../components/ProductForm'

describe('Product Form Validation', () => {
  const validFormData: ProductFormValues = {
    name: 'Papa Ipialeña',
    description: 'Papa recién cosechada',
    price: '500',
    quantity: '100',
    category: 'tubérculos',
    images: [new File([''], 'test.jpg')],
    pricePerUnit: '500',
    pricePerKilo: '',
    department: '52',
    municipality: '52019',
    condition: 'fresh',
    stockAvailable: true,
    detailedDescription: '<p>Descripción detallada</p>',
    location: 'Ipiales, Nariño'
  }

  describe('Price Validation', () => {
    it('should accept valid price per unit', () => {
      const data = { ...validFormData, pricePerUnit: '1000', pricePerKilo: '', price: '' }
      const errors = validateProductForm(data)
      expect(errors.pricePerUnit).toBeUndefined()
      expect(errors.pricePerKilo).toBeUndefined()
    })

    it('should accept valid price per kilo', () => {
      const data = { ...validFormData, pricePerUnit: '', pricePerKilo: '3500', price: '' }
      const errors = validateProductForm(data)
      expect(errors.pricePerUnit).toBeUndefined()
      expect(errors.pricePerKilo).toBeUndefined()
    })

    it('should accept both price per unit and per kilo', () => {
      const data = { ...validFormData, pricePerUnit: '500', pricePerKilo: '3500', price: '' }
      const errors = validateProductForm(data)
      expect(errors.pricePerUnit).toBeUndefined()
      expect(errors.pricePerKilo).toBeUndefined()
    })

    it('should reject when no price is provided', () => {
      const data = { ...validFormData, pricePerUnit: '', pricePerKilo: '', price: '' }
      const errors = validateProductForm(data)
      expect(errors.pricePerUnit).toContain('al menos un precio')
      expect(errors.pricePerKilo).toContain('al menos un precio')
    })

    it('should reject negative prices', () => {
      const data = { ...validFormData, pricePerUnit: '-100', pricePerKilo: '' }
      const errors = validateProductForm(data)
      expect(errors.pricePerUnit).toContain('mayor a 0')
    })

    it('should reject zero prices', () => {
      const data = { ...validFormData, pricePerUnit: '0', pricePerKilo: '' }
      const errors = validateProductForm(data)
      expect(errors.pricePerUnit).toContain('mayor a 0')
    })

    it('should reject invalid numeric prices', () => {
      const data = { ...validFormData, pricePerUnit: 'abc', pricePerKilo: '' }
      const errors = validateProductForm(data)
      expect(errors.pricePerUnit).toContain('mayor a 0')
    })
  })

  describe('Location Validation', () => {
    it('should accept valid department and municipality', () => {
      const data = { ...validFormData, department: '52', municipality: '52019' }
      const errors = validateProductForm(data)
      expect(errors.department).toBeUndefined()
      expect(errors.municipality).toBeUndefined()
    })

    it('should reject missing department', () => {
      const data = { ...validFormData, department: '', municipality: '52019' }
      const errors = validateProductForm(data)
      expect(errors.department).toContain('departamento')
    })

    it('should reject missing municipality', () => {
      const data = { ...validFormData, department: '52', municipality: '' }
      const errors = validateProductForm(data)
      expect(errors.municipality).toContain('municipio')
    })
  })

  describe('Product Condition Validation', () => {
    it('should accept valid conditions', () => {
      const conditions: Array<'fresh' | 'organic' | 'conventional'> = ['fresh', 'organic', 'conventional']
      conditions.forEach(condition => {
        const data = { ...validFormData, condition }
        const errors = validateProductForm(data)
        expect(errors.condition).toBeUndefined()
      })
    })

    it('should reject missing condition', () => {
      const data = { ...validFormData, condition: undefined }
      const errors = validateProductForm(data)
      expect(errors.condition).toContain('condición')
    })
  })

  describe('Basic Field Validation', () => {
    it('should accept valid basic fields', () => {
      const errors = validateProductForm(validFormData)
      expect(errors.name).toBeUndefined()
      expect(errors.description).toBeUndefined()
      expect(errors.quantity).toBeUndefined()
      expect(errors.category).toBeUndefined()
    })

    it('should reject missing name', () => {
      const data = { ...validFormData, name: '' }
      const errors = validateProductForm(data)
      expect(errors.name).toContain('obligatorio')
    })

    it('should reject missing description', () => {
      const data = { ...validFormData, description: '' }
      const errors = validateProductForm(data)
      expect(errors.description).toContain('Describe')
    })

    it('should reject description over 200 characters', () => {
      const data = { ...validFormData, description: 'a'.repeat(201) }
      const errors = validateProductForm(data)
      expect(errors.description).toContain('200 caracteres')
    })

    it('should reject empty quantity', () => {
      const data = { ...validFormData, quantity: '' }
      const errors = validateProductForm(data)
      expect(errors.quantity).toContain('obligatoria')
    })

    it('should reject missing category', () => {
      const data = { ...validFormData, category: '' }
      const errors = validateProductForm(data)
      expect(errors.category).toContain('categoría')
    })
  })

  describe('Image Validation', () => {
    it('should accept valid images', () => {
      const data = { ...validFormData, images: [new File([''], 'test1.jpg'), new File([''], 'test2.jpg')] }
      const errors = validateProductForm(data)
      expect(errors.images).toBeUndefined()
    })

    it('should reject no images', () => {
      const data = { ...validFormData, images: [] }
      const errors = validateProductForm(data)
      expect(errors.images).toContain('al menos una imagen')
    })
  })
})