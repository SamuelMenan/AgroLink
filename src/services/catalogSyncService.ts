import type { Product } from '../types/product'
import { listPublicProducts, updateProduct } from './productService'

export interface CatalogSyncOptions {
  batchSize?: number
  delayBetweenBatches?: number
  validateData?: boolean
  updateTimestamps?: boolean
  syncImages?: boolean
}

export interface SyncResult {
  totalProcessed: number
  updated: number
  errors: number
  warnings: string[]
  details: Array<{
    productId: string
    action: 'updated' | 'skipped' | 'error'
    message?: string
    changes?: Partial<Product>
  }>
}

export interface DataValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

/**
 * Servicio de sincronización automática del catálogo de productos
 * Mantiene la consistencia de datos y aplica mejoras automáticas
 */
export class CatalogSyncService {
  private static instance: CatalogSyncService
  
  private constructor() {}
  
  static getInstance(): CatalogSyncService {
    if (!CatalogSyncService.instance) {
      CatalogSyncService.instance = new CatalogSyncService()
    }
    return CatalogSyncService.instance
  }
  
  /**
   * Sincroniza el catálogo completo con validación y mejoras automáticas
   */
  async syncCatalog(options: CatalogSyncOptions = {}): Promise<SyncResult> {
    const {
      batchSize = 50,
      delayBetweenBatches = 1000,
      validateData = true,
      updateTimestamps = false,
      syncImages = false
    } = options
    
    const result: SyncResult = {
      totalProcessed: 0,
      updated: 0,
      errors: 0,
      warnings: [],
      details: []
    }
    
    try {
      // Obtener todos los productos activos
      const products = await listPublicProducts({
        limit: 1000,
        sort: 'relevance'
      })
      
      console.log(`[CatalogSync] Iniciando sincronización de ${products.length} productos`)
      
      // Procesar en lotes para evitar sobrecarga
      const batches = this.createBatches(products, batchSize)
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        console.log(`[CatalogSync] Procesando lote ${i + 1}/${batches.length} (${batch.length} productos)`)
        
        const batchResult = await this.processBatch(batch, {
          validateData,
          updateTimestamps,
          syncImages
        })
        
        // Acumular resultados
        result.totalProcessed += batchResult.totalProcessed
        result.updated += batchResult.updated
        result.errors += batchResult.errors
        result.warnings.push(...batchResult.warnings)
        result.details.push(...batchResult.details)
        
        // Esperar entre lotes para evitar sobrecarga del servidor
        if (i < batches.length - 1) {
          await this.delay(delayBetweenBatches)
        }
      }
      
      console.log(`[CatalogSync] Sincronización completada: ${result.updated} actualizados, ${result.errors} errores`)
      
    } catch (error) {
      console.error('[CatalogSync] Error en sincronización:', error)
      result.errors++
      result.warnings.push(`Error general: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
    
    return result
  }
  
  /**
   * Valida y sugiere mejoras para un producto individual
   */
  validateProductData(product: Product): DataValidationResult {
    const result: DataValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }
    
    // Validar nombre del producto
    if (!product.name || product.name.trim().length < 3) {
      result.errors.push('El nombre del producto debe tener al menos 3 caracteres')
      result.isValid = false
    }
    
    if (product.name.length > 100) {
      result.warnings.push('El nombre del producto es muy largo (máx 100 caracteres)')
    }
    
    // Validar descripción
    if (!product.description || product.description.trim().length < 10) {
      result.errors.push('La descripción debe tener al menos 10 caracteres')
      result.isValid = false
    }
    
    if (product.description.length > 200) {
      result.warnings.push('La descripción excede el límite de 200 caracteres')
    }
    
    // Validar precio
    if (product.price <= 0) {
      result.errors.push('El precio debe ser mayor a 0')
      result.isValid = false
    }
    
    if (product.price > 1000000000) {
      result.warnings.push('El precio parece muy alto, verificar si es correcto')
    }
    
    // Validar cantidad
    if (!product.quantity || product.quantity.trim().length === 0) {
      result.errors.push('La cantidad es requerida')
      result.isValid = false
    }
    
    // Validar categoría
    const validCategories = ['frutas', 'verduras', 'granos', 'lácteos', 'tubérculos', 'hierbas', 'otros']
    if (!validCategories.includes(product.category)) {
      result.warnings.push(`Categoría no válida: ${product.category}`)
    }
    
    // Validar ubicación
    if (!product.location && (!product.department || !product.municipality)) {
      result.warnings.push('Falta información de ubicación (departamento/municipio)')
    }
    
    // Validar imágenes
    if (!product.image_urls || product.image_urls.length === 0) {
      result.warnings.push('El producto no tiene imágenes')
    }
    
    if (product.image_urls && product.image_urls.length > 5) {
      result.warnings.push('El producto tiene muchas imágenes (máx recomendado: 5)')
    }
    
    // Sugerencias de mejora
    if (!product.detailed_description) {
      result.suggestions.push('Agregar descripción detallada para mejorar la visibilidad')
    }
    
    if (!product.condition) {
      result.suggestions.push('Especificar condición del producto (fresco, orgánico, convencional)')
    }
    
    if (!product.price_per_unit && !product.price_per_kilo) {
      result.suggestions.push('Agregar precio por unidad o por kilo para mayor claridad')
    }
    
    if (product.stock_available === undefined) {
      result.suggestions.push('Indicar si hay stock disponible')
    }
    
    return result
  }
  
  /**
   * Aplica mejoras automáticas al producto
   */
  private applyAutomaticImprovements(product: Product): Partial<Product> {
    const improvements: Partial<Product> = {}
    
    // Mejorar formato del nombre
    if (product.name) {
      const improvedName = this.improveProductName(product.name)
      if (improvedName !== product.name) {
        improvements.name = improvedName
      }
    }
    
    // Mejorar descripción
    if (product.description) {
      const improvedDescription = this.improveDescription(product.description)
      if (improvedDescription !== product.description) {
        improvements.description = improvedDescription
      }
    }
    
    // Agregar información de ubicación si falta
    if (product.department && product.municipality && !product.location) {
      improvements.location = `${product.municipality}, ${product.department}`
    }
    
    // Establecer stock disponible por defecto
    if (product.stock_available === undefined) {
      improvements.stock_available = true
    }
    
    // Mejorar formato de cantidad
    if (product.quantity) {
      const improvedQuantity = this.improveQuantityFormat(product.quantity)
      if (improvedQuantity !== product.quantity) {
        improvements.quantity = improvedQuantity
      }
    }
    
    return improvements
  }
  
  /**
   * Procesa un lote de productos
   */
  private async processBatch(
    products: Product[],
    options: {
      validateData: boolean
      updateTimestamps: boolean
      syncImages: boolean
    }
  ): Promise<SyncResult> {
    const result: SyncResult = {
      totalProcessed: 0,
      updated: 0,
      errors: 0,
      warnings: [],
      details: []
    }
    
    for (const product of products) {
      try {
        result.totalProcessed++
        
        let needsUpdate = false
        const changes: Partial<Product> = {}
        
        // Validar datos si está habilitado
        if (options.validateData) {
          const validation = this.validateProductData(product)
          
          if (!validation.isValid) {
            result.warnings.push(`Producto ${product.id}: ${validation.errors.join(', ')}`)
            result.details.push({
              productId: product.id,
              action: 'skipped',
              message: 'Validación fallida',
              changes: {}
            })
            continue
          }
          
          // Aplicar mejoras automáticas
          const improvements = this.applyAutomaticImprovements(product)
          Object.assign(changes, improvements)
          needsUpdate = Object.keys(improvements).length > 0
        }
        
        // Actualizar timestamp si está habilitado
        if (options.updateTimestamps && !needsUpdate) {
          changes.updated_at = new Date().toISOString()
          needsUpdate = true
        }
        
        // Aplicar cambios si es necesario
        if (needsUpdate) {
          try {
            await updateProduct(product.id, changes)
            result.updated++
            result.details.push({
              productId: product.id,
              action: 'updated',
              changes
            })
          } catch (error) {
            result.errors++
            result.details.push({
              productId: product.id,
              action: 'error',
              message: `Error actualizando: ${error instanceof Error ? error.message : 'Error desconocido'}`
            })
          }
        } else {
          result.details.push({
            productId: product.id,
            action: 'skipped',
            message: 'Sin cambios necesarios'
          })
        }
        
      } catch (error) {
        result.errors++
        result.warnings.push(`Error procesando producto ${product.id}: ${error instanceof Error ? error.message : 'Error desconocido'}`)
        result.details.push({
          productId: product.id,
          action: 'error',
          message: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }
    
    return result
  }
  
  /**
   * Mejora el nombre del producto
   */
  private improveProductName(name: string): string {
    let improved = name.trim()
    
    // Capitalizar primera letra de cada palabra
    improved = improved.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
    
    // Eliminar espacios múltiples
    improved = improved.replace(/\s+/g, ' ')
    
    // Eliminar caracteres especiales no permitidos
    improved = improved.replace(/[^\w\sÁáÉéÍíÓóÚúÑñÜü\-°]/g, '')
    
    return improved
  }
  
  /**
   * Mejora la descripción del producto
   */
  private improveDescription(description: string): string {
    let improved = description.trim()
    
    // Capitalizar primera letra
    improved = improved.charAt(0).toUpperCase() + improved.slice(1)
    
    // Eliminar espacios múltiples
    improved = improved.replace(/\s+/g, ' ')
    
    // Eliminar caracteres especiales no permitidos
    improved = improved.replace(/[^\w\sÁáÉéÍíÓóÚúÑñÜü\-°.,;:!?()]/g, '')
    
    return improved
  }
  
  /**
   * Mejora el formato de la cantidad
   */
  private improveQuantityFormat(quantity: string): string {
    let improved = quantity.trim()
    
    // Normalizar unidades agrícolas
    improved = improved.replace(/arrobas?/gi, 'arroba')
    improved = improved.replace(/fanegas?/gi, 'fanega')
    improved = improved.replace(/@/g, 'arroba')
    
    return improved
  }
  
  /**
   * Crea lotes de productos para procesamiento por lotes
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }
  
  /**
   * Retardo asíncrono
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Exportar instancia singleton
export const catalogSyncService = CatalogSyncService.getInstance()