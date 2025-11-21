// Agricultural unit conversion system for Colombian farmers

export interface UnitConversion {
  from: string
  to: string
  factor: number
  category: 'weight' | 'volume' | 'area' | 'quantity'
}

// Colombian agricultural units and conversions
export const AGRICULTURAL_CONVERSIONS: UnitConversion[] = [
  // Weight conversions
  { from: 'arroba', to: 'kg', factor: 12.5, category: 'weight' },
  { from: 'libra', to: 'kg', factor: 0.453592, category: 'weight' },
  { from: 'quintal', to: 'kg', factor: 100, category: 'weight' },
  { from: 'tonelada', to: 'kg', factor: 1000, category: 'weight' },
  
  // Volume conversions
  { from: 'galón', to: 'l', factor: 3.78541, category: 'volume' },
  { from: 'botella', to: 'l', factor: 0.75, category: 'volume' }, // wine bottle
  { from: 'garrafa', to: 'l', factor: 5, category: 'volume' }, // 5L jug
  
  // Area conversions
  { from: 'fanega', to: 'm²', factor: 6400, category: 'area' }, // traditional Colombian unit
  { from: 'hectárea', to: 'm²', factor: 10000, category: 'area' },
  { from: 'caballería', to: 'm²', factor: 134400, category: 'area' }, // Colombian caballería
  
  // Quantity conversions
  { from: 'docena', to: 'unidad', factor: 12, category: 'quantity' },
  { from: 'ciento', to: 'unidad', factor: 100, category: 'quantity' },
  { from: 'millar', to: 'unidad', factor: 1000, category: 'quantity' }
]

export interface ConversionResult {
  value: number
  unit: string
  originalValue: number
  originalUnit: string
  category: string
}

// Convert between agricultural units
export function convertAgriculturalUnit(value: number, fromUnit: string, toUnit: string): ConversionResult | null {
  // Direct conversion
  const directConversion = AGRICULTURAL_CONVERSIONS.find(c => 
    c.from.toLowerCase() === fromUnit.toLowerCase() && 
    c.to.toLowerCase() === toUnit.toLowerCase()
  )
  
  if (directConversion) {
    return {
      value: value * directConversion.factor,
      unit: toUnit,
      originalValue: value,
      originalUnit: fromUnit,
      category: directConversion.category
    }
  }
  
  // Reverse conversion
  const reverseConversion = AGRICULTURAL_CONVERSIONS.find(c => 
    c.from.toLowerCase() === toUnit.toLowerCase() && 
    c.to.toLowerCase() === fromUnit.toLowerCase()
  )
  
  if (reverseConversion) {
    return {
      value: value / reverseConversion.factor,
      unit: toUnit,
      originalValue: value,
      originalUnit: fromUnit,
      category: reverseConversion.category
    }
  }
  
  // Conversion through base unit (kg, l, m², unidad)
  const fromConversion = AGRICULTURAL_CONVERSIONS.find(c => c.from.toLowerCase() === fromUnit.toLowerCase())
  const toConversion = AGRICULTURAL_CONVERSIONS.find(c => c.from.toLowerCase() === toUnit.toLowerCase())
  
  if (fromConversion && toConversion && fromConversion.category === toConversion.category) {
    // Convert to base unit first
    const baseValue = value * fromConversion.factor
    // Then convert from base unit to target
    const finalValue = baseValue / toConversion.factor
    
    return {
      value: finalValue,
      unit: toUnit,
      originalValue: value,
      originalUnit: fromUnit,
      category: fromConversion.category
    }
  }
  
  return null
}

// Format agricultural quantity with conversions
export function formatAgriculturalQuantity(input: string): string {
  const parsed = parseAgriculturalInput(input)
  if (!parsed) return 'Formato no válido'
  
  const conversions: string[] = []
  
  // Convert to common units
  if (parsed.unit === 'arroba') {
    const kg = convertAgriculturalUnit(parsed.value, 'arroba', 'kg')
    if (kg) conversions.push(`${kg.value.toFixed(1)} kg`)
  } else if (parsed.unit === 'kg') {
    const arroba = convertAgriculturalUnit(parsed.value, 'kg', 'arroba')
    if (arroba) conversions.push(`${arroba.value.toFixed(1)} @`)
  }
  
  if (parsed.unit === 'fanega') {
    const m2 = convertAgriculturalUnit(parsed.value, 'fanega', 'm²')
    if (m2) conversions.push(`${m2.value.toFixed(0)} m²`)
    const ha = convertAgriculturalUnit(parsed.value, 'fanega', 'hectárea')
    if (ha) conversions.push(`${ha.value.toFixed(2)} ha`)
  }
  
  if (conversions.length > 0) {
    return `${formatAgriculturalValue(parsed.value, parsed.unit)} ≈ ${conversions.join(', ')}`
  }
  
  return formatAgriculturalValue(parsed.value, parsed.unit)
}

// Get available units for a category
export function getUnitsByCategory(category: string): string[] {
  const units = new Set<string>()
  
  AGRICULTURAL_CONVERSIONS.forEach(conversion => {
    if (conversion.category === category) {
      units.add(conversion.from)
      units.add(conversion.to)
    }
  })
  
  return Array.from(units).sort()
}

// Get common agricultural units with their symbols
export const AGRICULTURAL_UNIT_SYMBOLS: Record<string, string> = {
  // Weight
  'kg': 'kg',
  'g': 'g',
  'lb': 'lb',
  'arroba': '@',
  'quintal': 'qq',
  'tonelada': 't',
  'libra': 'lb',
  
  // Volume
  'l': 'L',
  'ml': 'mL',
  'galón': 'gal',
  'botella': 'bot',
  'garrafa': 'gar',
  
  // Area
  'm²': 'm²',
  'hectárea': 'ha',
  'fanega': 'fan',
  'caballería': 'cab',
  
  // Quantity
  'unidad': 'u',
  'docena': 'doc',
  'ciento': 'cien',
  'millar': 'mill'
}

// Suggest common conversions for a unit
export function suggestConversions(unit: string): string[] {
  const unitData = AGRICULTURAL_CONVERSIONS.find(c => 
    c.from.toLowerCase() === unit.toLowerCase()
  )
  
  if (!unitData) return []
  
  const category = unitData.category
  const availableUnits = getUnitsByCategory(category)
  
  // Remove the original unit and sort by common usage
  return availableUnits.filter(u => u.toLowerCase() !== unit.toLowerCase())
}

// Format agricultural value with appropriate unit
export function formatAgriculturalValue(value: number, unit: string, decimals: number = 2): string {
  const symbol = AGRICULTURAL_UNIT_SYMBOLS[unit] || unit
  return `${value.toFixed(decimals)} ${symbol}`
}

// Parse agricultural input (handle both unit names and symbols)
export function parseAgriculturalInput(input: string): { value: number; unit: string } | null {
  const trimmed = input.trim()
  
  // Try to match value and unit
  const match = trimmed.match(/^([0-9.,]+)\s*([a-zA-Z²°@#]+)$/)
  if (match) {
    const value = parseFloat(match[1].replace(',', '.'))
    const unitSymbol = match[2].toLowerCase()
    
    // Find unit by symbol
    const unitEntry = Object.entries(AGRICULTURAL_UNIT_SYMBOLS).find(([_, symbol]) => 
      symbol.toLowerCase() === unitSymbol
    )
    
    if (unitEntry) {
      return { value, unit: unitEntry[0] }
    }
    
    // Try direct unit name
    const conversion = AGRICULTURAL_CONVERSIONS.find(c => 
      c.from.toLowerCase() === unitSymbol || c.to.toLowerCase() === unitSymbol
    )
    
    if (conversion) {
      return { value, unit: conversion.from }
    }
  }
  
  return null
}