// Agricultural input validation utilities
export interface ValidationRule {
  pattern: RegExp
  message: string
  allowEmpty?: boolean
}

export interface ValidationResult {
  isValid: boolean
  error?: string
}

// Common agricultural symbols and characters
export const AGRICULTURAL_SYMBOLS = /[%\/\-°@#$*+,.;:?¿¡!()]/

// Validation rules for different field types
export const VALIDATION_RULES = {
  productName: {
    pattern: /^[A-Za-zÁáÉéÍíÓóÚúÑñÜü0-9\s\-°]+$/,
    message: 'Solo se permiten letras, números, espacios y guiones'
  },
  productDescription: {
    pattern: /^[A-Za-zÁáÉéÍíÓóÚúÑñÜü0-9\s%\/\-°@#$*+,.;:?¿¡!()]+$/,
    message: 'Caracteres especiales no permitidos'
  },
  description: {
    pattern: /^[A-Za-zÁáÉéÍíÓóÚúÑñÜü0-9\s%\/\-°@#$*+,.;:?¿¡!()]+$/,
    message: 'Caracteres especiales no permitidos'
  },
  location: {
    pattern: /^[A-Za-zÁáÉéÍíÓóÚúÑñÜü\s\-]+$/,
    message: 'Solo se permiten letras, espacios y guiones'
  },
  price: {
    pattern: /^\d*\.?\d+$/,
    message: 'Solo se permiten números y puntos decimales'
  },
  quantity: {
    pattern: /^\d+$/,
    message: 'Solo se permiten números'
  },
  searchQuery: {
    pattern: /^[A-Za-zÁáÉéÍíÓóÚúÑñÜü0-9\s\-]+$/,
    message: 'Caracteres no permitidos en búsqueda',
    allowEmpty: true
  }
} as const

// Real-time validation function
export function validateInput(value: string, rule: ValidationRule): ValidationResult {
  if (rule.allowEmpty && !value.trim()) {
    return { isValid: true }
  }
  
  if (!value.trim()) {
    return { isValid: false, error: 'Este campo es obligatorio' }
  }
  
  // Trim whitespace and validate
  const trimmedValue = value.trim()
  if (!rule.pattern.test(trimmedValue)) {
    return { isValid: false, error: rule.message }
  }
  
  // Check for leading/trailing spaces
  if (value !== trimmedValue) {
    return { isValid: false, error: 'No se permiten espacios al inicio o final' }
  }
  
  return { isValid: true }
}

// Sanitize input by removing invalid characters
export function sanitizeInput(value: string, rule: ValidationRule): string {
  if (rule.allowEmpty && !value) return value
  
  // Remove invalid characters based on the pattern
  return value.replace(/[^A-Za-zÁáÉéÍíÓóÚúÑñÜü0-9\s%\/\-°@#$*+,.;:?¿¡!()]/g, '')
}

// Get validation icon based on result
export function getValidationIcon(isValid?: boolean): string {
  if (isValid === undefined) return ''
  return isValid ? '✓' : '✗'
}

// Get validation color class
export function getValidationColorClass(isValid?: boolean): string {
  if (isValid === undefined) return 'border-gray-300'
  return isValid ? 'border-green-500 focus:border-green-500' : 'border-red-500 focus:border-red-500'
}

// Agricultural unit validation
export const AGRICULTURAL_UNITS = {
  weight: ['kg', 'g', 'lb', 'arroba', 'tonelada', 'quintal'],
  volume: ['l', 'ml', 'gal', 'botella', 'garrafa'],
  area: ['m²', 'ha', 'fanega', 'caballería'],
  quantity: ['unidad', 'docena', 'ciento', 'millar']
} as const

// Validate agricultural units
export function validateAgriculturalUnit(value: string, unitType: keyof typeof AGRICULTURAL_UNITS): boolean {
  const validUnits = AGRICULTURAL_UNITS[unitType]
  return (validUnits as readonly string[]).includes(value)
}