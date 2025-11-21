import type { ProductFormValues } from '../components/ProductForm'

export function validateProductForm(values: ProductFormValues): Partial<Record<keyof ProductFormValues, string>> {
  const errors: Partial<Record<keyof ProductFormValues, string>> = {}
  
  // Basic validations
  if (!values.name.trim()) errors.name = 'El nombre del producto es obligatorio.'
  if (!values.description.trim()) errors.description = 'Describe brevemente tu producto.'
  if (values.description.trim().length > 200) errors.description = 'Máximo 200 caracteres.'
  
  // Price validation - at least one price field is required
  const pricePerUnitNum = Number(values.pricePerUnit)
  const pricePerKiloNum = Number(values.pricePerKilo)
  const priceNum = Number(values.price)
  
  if (!values.pricePerUnit && !values.pricePerKilo && !values.price) {
    errors.pricePerUnit = 'Debes ingresar al menos un precio.'
    errors.pricePerKilo = 'Debes ingresar al menos un precio.'
  } else {
    if (values.pricePerUnit && (Number.isNaN(pricePerUnitNum) || pricePerUnitNum <= 0)) {
      errors.pricePerUnit = 'Precio por unidad debe ser mayor a 0.'
    }
    if (values.pricePerKilo && (Number.isNaN(pricePerKiloNum) || pricePerKiloNum <= 0)) {
      errors.pricePerKilo = 'Precio por kilo debe ser mayor a 0.'
    }
    if (values.price && (Number.isNaN(priceNum) || priceNum <= 0)) {
      errors.price = 'Precio debe ser mayor a 0.'
    }
  }
  
  // Quantity validation - accept text with units
  if (!values.quantity || !values.quantity.trim()) {
    errors.quantity = 'La cantidad es obligatoria.'
  }
  
  if (!values.category) errors.category = 'Selecciona una categoría.'
  
  // Location validation
  if (!values.department) errors.department = 'Selecciona un departamento.'
  if (!values.municipality) errors.municipality = 'Selecciona un municipio.'
  
  // Condition validation
  if (!values.condition) errors.condition = 'Selecciona la condición del producto.'
  
  // Images validation
  const existingCount = values.existing_image_urls?.length || 0
  const newCount = values.images?.length || 0
  if (existingCount + newCount < 1) errors.images = 'Agrega al menos una imagen.'
  
  return errors
}