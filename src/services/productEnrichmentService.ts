import { AGRICULTURAL_GLOSSARY } from '../utils/agriculturalGlossary'

export interface EnrichmentResult {
  original: string
  enriched: string
  improvements: string[]
  agriculturalTerms: string[]
  confidence: number
}

export interface ProductEnrichmentOptions {
  addAgriculturalTerms?: boolean
  improveGrammar?: boolean
  addTechnicalDetails?: boolean
  translateUnits?: boolean
  optimizeForSearch?: boolean
}

/**
 * Servicio de enriquecimiento de datos de productos agrícolas
 * Mejora descripciones y añade terminología técnica específica
 */
export class ProductEnrichmentService {
  private static instance: ProductEnrichmentService
  
  private constructor() {}
  
  static getInstance(): ProductEnrichmentService {
    if (!ProductEnrichmentService.instance) {
      ProductEnrichmentService.instance = new ProductEnrichmentService()
    }
    return ProductEnrichmentService.instance
  }
  
  /**
   * Enriquece la descripción de un producto con terminología agrícola
   */
  enrichDescription(
    description: string, 
    category: string,
    options: ProductEnrichmentOptions = {}
  ): EnrichmentResult {
    const {
      addAgriculturalTerms = true,
      improveGrammar = true,
      addTechnicalDetails = true,
      translateUnits = true,
      optimizeForSearch = true
    } = options
    
    let enriched = description
    const improvements: string[] = []
    const agriculturalTerms: string[] = []
    
    // Paso 1: Mejorar gramática y puntuación
    if (improveGrammar) {
      const grammarResult = this.improveGrammar(enriched)
      if (grammarResult !== enriched) {
        enriched = grammarResult
        improvements.push('Mejorada gramática y puntuación')
      }
    }
    
    // Paso 2: Agregar términos agrícolas relevantes
    if (addAgriculturalTerms) {
      const termsResult = this.addAgriculturalTerms(enriched, category)
      enriched = termsResult.text
      agriculturalTerms.push(...termsResult.terms)
      if (termsResult.terms.length > 0) {
        improvements.push(`Agregados ${termsResult.terms.length} términos agrícolas`)
      }
    }
    
    // Paso 3: Agregar detalles técnicos según categoría
    if (addTechnicalDetails) {
      const technicalResult = this.addTechnicalDetails(enriched, category)
      if (technicalResult !== enriched) {
        enriched = technicalResult
        improvements.push('Agregados detalles técnicos específicos')
      }
    }
    
    // Paso 4: Traducir unidades a formato agrícola
    if (translateUnits) {
      const unitsResult = this.translateToAgriculturalUnits(enriched)
      if (unitsResult !== enriched) {
        enriched = unitsResult
        improvements.push('Convertidas unidades a formato agrícola')
      }
    }
    
    // Paso 5: Optimizar para búsqueda
    if (optimizeForSearch) {
      const searchResult = this.optimizeForSearch(enriched, category)
      if (searchResult !== enriched) {
        enriched = searchResult
        improvements.push('Optimizado para búsqueda')
      }
    }
    
    // Calcular confianza basada en la cantidad de mejoras
    const confidence = Math.min(0.9, improvements.length * 0.2)
    
    return {
      original: description,
      enriched,
      improvements,
      agriculturalTerms,
      confidence
    }
  }
  
  /**
   * Mejora la gramática y puntuación del texto
   */
  private improveGrammar(text: string): string {
    let improved = text
    
    // Capitalizar primera letra
    improved = improved.charAt(0).toUpperCase() + improved.slice(1)
    
    // Asegurar punto final
    if (!improved.endsWith('.') && !improved.endsWith('!') && !improved.endsWith('?')) {
      improved += '.'
    }
    
    // Corregir espacios antes de signos de puntuación
    improved = improved.replace(/\s+([,.;:!?])/g, '$1')
    
    // Agregar espacio después de signos de puntuación
    improved = improved.replace(/([,.;:!?])([^\s])/g, '$1 $2')
    
    // Eliminar espacios múltiples
    improved = improved.replace(/\s+/g, ' ')
    
    return improved.trim()
  }
  
  /**
   * Agrega términos agrícolas relevantes al texto
   */
  private addAgriculturalTerms(text: string, category: string): { text: string; terms: string[] } {
    const terms: string[] = []
    let enriched = text
    
    // Buscar términos relacionados en el glosario
    const glossaryTerms = this.searchAgriculturalTerms(text)
    
    // Agregar términos específicos por categoría
    const categoryTerms = this.getCategorySpecificTerms(category)
    const allTerms = [...glossaryTerms, ...categoryTerms]
    
    // Si no hay suficientes términos técnicos, agregar algunos relevantes
    if (allTerms.length < 3) {
      const additionalTerms = this.getAdditionalTerms(category)
      allTerms.push(...additionalTerms)
    }
    
    // Agregar términos al texto de manera natural
    if (allTerms.length > 0 && !this.hasSufficientAgriculturalTerms(text)) {
      const uniqueTerms = [...new Set(allTerms)].slice(0, 3)
      const termsText = uniqueTerms.join(', ')
      
      if (!enriched.toLowerCase().includes('características')) {
        enriched += ` Características: ${termsText}.`
      } else {
        enriched += ` Incluye ${termsText}.`
      }
      
      terms.push(...uniqueTerms)
    }
    
    return { text: enriched, terms }
  }
  
  /**
   * Agrega detalles técnicos específicos por categoría
   */
  private addTechnicalDetails(text: string, category: string): string {
    let enriched = text
    
    const technicalDetails = this.getTechnicalDetailsForCategory(category)
    
    if (technicalDetails && !this.hasTechnicalDetails(text)) {
      enriched += ` ${technicalDetails}`
    }
    
    return enriched
  }
  
  /**
   * Traduce unidades a formato agrícola estándar
   */
  private translateToAgriculturalUnits(text: string): string {
    let translated = text
    
    // Convertir referencias a unidades estándar
    const unitMappings = {
      'kilos?': 'kg',
      'gramos?': 'g',
      'toneladas?': 't',
      'litros?': 'L',
      'mililitros?': 'mL',
      'metros cuadrados?': 'm²',
      'hectáreas?': 'ha'
    }
    
    Object.entries(unitMappings).forEach(([pattern, replacement]) => {
      const regex = new RegExp(pattern, 'gi')
      translated = translated.replace(regex, replacement)
    })
    
    return translated
  }
  
  /**
   * Optimiza el texto para búsqueda
   */
  private optimizeForSearch(text: string, category: string): string {
    let optimized = text
    
    // Agregar palabras clave relevantes
    const keywords = this.getSearchKeywords(category)
    
    if (keywords.length > 0) {
      const currentKeywords = this.extractKeywords(text)
      const missingKeywords = keywords.filter(kw => !currentKeywords.includes(kw.toLowerCase()))
      
      if (missingKeywords.length > 0) {
        optimized = `${optimized} Palabras clave: ${missingKeywords.slice(0, 3).join(', ')}.`
      }
    }
    
    return optimized
  }
  
  /**
   * Obtiene términos específicos por categoría
   */
  private getCategorySpecificTerms(category: string): string[] {
    const termsByCategory: Record<string, string[]> = {
      'frutas': ['madurez', 'cosecha', 'calibre', 'firmeza', 'aroma'],
      'verduras': ['fresco', 'hoja', 'tallo', 'raíz', 'verde'],
      'granos': ['secado', 'humedad', 'impurezas', 'granulometría', 'peso específico'],
      'lácteos': ['pasteurización', 'fermentación', 'grasa', 'proteína', 'vida útil'],
      'tubérculos': ['almidón', 'sólidos totales', 'textura', 'color interno', 'tamaño'],
      'hierbas': ['esencias', 'aceites esenciales', 'aroma', 'secado', 'hojas'],
      'otros': ['agricola', 'campo', 'cultivo', 'cosecha', 'calidad']
    }
    
    return termsByCategory[category] || termsByCategory['otros']
  }
  
  /**
   * Obtiene términos adicionales relevantes
   */
  private getAdditionalTerms(category: string): string[] {
    const additionalTerms: Record<string, string[]> = {
      'frutas': ['natural', 'campo', 'fresco', 'saludable'],
      'verduras': ['organico', 'campesino', 'fresco', 'nutritivo'],
      'granos': ['seco', 'limpio', 'seleccionado', 'grado'],
      'lácteos': ['fresco', 'natural', 'campo', 'artesanal'],
      'tubérculos': ['campo', 'tierra', 'fresco', 'natural'],
      'hierbas': ['natural', 'medicinal', 'aromatico', 'campo'],
      'otros': ['calidad', 'campesino', 'tradicional', 'natural']
    }
    
    return additionalTerms[category] || additionalTerms['otros']
  }
  
  /**
   * Obtiene detalles técnicos por categoría
   */
  private getTechnicalDetailsForCategory(category: string): string {
    const technicalDetails: Record<string, string> = {
      'frutas': 'Presentación en cajas de cartón corrugado con protección individual.',
      'verduras': 'Empacado en cajas de madera o plástico con separadores.',
      'granos': 'Almacenado en condiciones óptimas de humedad y temperatura.',
      'lácteos': 'Transportado en condiciones refrigeradas para mantener la cadena de frío.',
      'tubérculos': 'Almacenado en ambiente fresco y seco para máxima conservación.',
      'hierbas': 'Secado natural para preservar propiedades aromáticas y medicinales.',
      'otros': 'Manejo adecuado según estándares agrícolas de calidad.'
    }
    
    return technicalDetails[category] || technicalDetails['otros']
  }
  
  /**
   * Obtiene palabras clave para búsqueda
   */
  private getSearchKeywords(category: string): string[] {
    const keywords: Record<string, string[]> = {
      'frutas': ['fruta', 'fruta fresca', 'campesino', 'agricultor'],
      'verduras': ['verdura', 'verduras frescas', 'hortaliza', 'campesino'],
      'granos': ['grano', 'cereal', 'semilla', 'agricultor'],
      'lácteos': ['leche', 'lácteo', 'producto lácteo', 'campesino'],
      'tubérculos': ['tubérculo', 'raíz', 'papa', 'yuca', 'campesino'],
      'hierbas': ['hierba', 'medicinal', 'aromática', 'campesino'],
      'otros': ['agricola', 'campo', 'producto', 'campesino']
    }
    
    return keywords[category] || keywords['otros']
  }
  
  /**
   * Busca términos agrícolas en el texto
   */
  private searchAgriculturalTerms(text: string): string[] {
    const foundTerms: string[] = []
    const lowerText = text.toLowerCase()
    
    AGRICULTURAL_GLOSSARY.forEach(term => {
      if (lowerText.includes(term.term.toLowerCase())) {
        foundTerms.push(term.term)
      }
    })
    
    return foundTerms
  }
  
  /**
   * Verifica si el texto tiene suficientes términos agrícolas
   */
  private hasSufficientAgriculturalTerms(text: string): boolean {
    const glossaryTerms = this.searchAgriculturalTerms(text)
    return glossaryTerms.length >= 2
  }
  
  /**
   * Verifica si el texto tiene detalles técnicos
   */
  private hasTechnicalDetails(text: string): boolean {
    const technicalIndicators = ['presentación', 'empacado', 'almacenado', 'transportado', 'condiciones']
    return technicalIndicators.some(indicator => text.toLowerCase().includes(indicator))
  }
  
  /**
   * Extrae palabras clave del texto
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/)
    return [...new Set(words.filter(word => word.length > 3))]
  }
}

// Exportar instancia singleton
export const productEnrichmentService = ProductEnrichmentService.getInstance()