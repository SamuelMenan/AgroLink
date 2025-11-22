import { apiFetch } from './apiClient'

export interface AIChatRequest {
  prompt: string
  system?: string
}

export interface AIChatResponse {
  output_text: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export interface AIErrorResponse {
  error: string
}

/**
 * Recomendaciones predeterminadas cuando la IA no está disponible
 * @param productName - Nombre del producto
 * @param category - Categoría del producto
 * @returns Recomendaciones básicas
 */
function getFallbackProductRecommendations(productName: string, category: string): string {
  return `🌱 **Recomendaciones para ${productName} (${category})**

**Almacenamiento:**
• Guardar en lugar fresco y seco
• Evitar exposición directa a la luz solar
• Mantener en recipiente adecuado para preservar frescura

**Consumo:**
• Lavar antes de consumir
• Consumir preferiblemente fresco para mejor sabor y valor nutricional
• Puede utilizarse en diversas preparaciones culinarias

**Beneficios:**
• Rico en vitaminas y minerales esenciales
• Fuente natural de nutrientes
• Contribuye a una dieta balanceada

**Temporada:**
• Disponible durante temporada de cosecha
• Mejor calidad y precio en temporada alta

**Consejos:**
• Seleccionar productos con buena apariencia y firmeza
• Almacenar adecuadamente para prolongar vida útil
• Consumir dentro del período de frescura óptimo`
}

/**
 * Consejos de cultivo predeterminados cuando la IA no está disponible
 * @param productName - Nombre del producto
 * @param category - Categoría del producto
 * @returns Consejos básicos de cultivo
 */
function getFallbackCultivationTips(productName: string, category: string): string {
  return `🌿 **Consejos de Cultivo para ${productName} (${category})**

**Clima y Suelo:**
• Clima templado a cálido según especie
• Suelo bien drenado y fértil
• pH neutro a ligeramente ácido (6.0-7.0)
• Buena exposición solar (6-8 horas diarias)

**Época de Siembra:**
• Siembra en temporada apropiada según región
• Considerar últimas heladas en zonas frías
• Rotación de cultivos para mantener salud del suelo

**Riego y Fertilización:**
• Riego regular sin encharcar
• Mantener humedad constante durante crecimiento
• Fertilización orgánica o balanceada según necesidades
• Compost o materia orgánica para mejorar suelo

**Manejo de Plagas:**
• Monitoreo regular para detección temprana
• Control biológico cuando sea posible
• Mantener buena ventilación para prevenir enfermedades
• Prácticas de cultivo limpias y ordenadas

**Cosecha:**
• Señales de madurez según tipo de producto
• Color, tamaño y firmeza apropiados
• Cosecha en horas frescas del día
• Manejo cuidadoso para evitar daños`
}

/**
 * Servicio para interactuar con el módulo de IA (DeepseekController)
 * Permite hacer preguntas y obtener respuestas de la IA
 */
export const aiService = {
  /**
   * Enviar un mensaje al chat de IA
   * @param request - Objeto con el prompt y sistema opcional
   * @returns Promesa con la respuesta de la IA o error
   */
  chat: async (request: AIChatRequest): Promise<AIChatResponse> => {
    try {
      const response = await apiFetch('/api/v1/ai/deepseek/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: request.prompt,
          system: request.system || "Eres un asistente de AgroLink especializado en agricultura. Responde en español con pasos claros y breves."
        })
      })

      if (!response.ok) {
        const errorData: AIErrorResponse = await response.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }

      const data: AIChatResponse = await response.json()
      return data
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Error al comunicarse con el servicio de IA')
    }
  },

  /**
   * Enviar un mensaje rápido con un prompt simple
   * @param prompt - Texto del mensaje
   * @returns Promesa con la respuesta de la IA
   */
  quickChat: async (prompt: string): Promise<string> => {
    const response = await aiService.chat({ prompt })
    return response.output_text
  },

  /**
   * Obtener sugerencias para preguntas frecuentes en agricultura
   * @returns Array de sugerencias de preguntas
   */
  getSuggestedQuestions: (): string[] => {
    return [
      "¿Cómo puedo mejorar la calidad de mis cultivos?",
      "¿Qué productos son más rentables para vender?",
      "¿Cómo puedo almacenar mis productos frescos por más tiempo?",
      "¿Qué técnicas de riego me recomiendas?",
      "¿Cómo puedo prevenir plagas de forma natural?",
      "¿Cuál es el mejor momento para cosechar?",
      "¿Cómo puedo obtener mejores precios para mis productos?",
      "¿Qué certificaciones necesito para vender productos orgánicos?"
    ]
  },

  /**
   * Obtener recomendaciones específicas para un producto
   * @param productName - Nombre del producto
   * @param category - Categoría del producto
   * @param description - Descripción del producto
   * @returns Promesa con recomendaciones de la IA
   */
  getProductRecommendations: async (productName: string, category: string, description?: string): Promise<string> => {
    const prompt = `Basándote en el producto "${productName}" de la categoría "${category}"${description ? ` con descripción: "${description}"` : ''}, por favor proporciona:

1. Consejos de almacenamiento y conservación
2. Formas de consumo o uso recomendadas  
3. Beneficios nutricionales o propiedades destacadas
4. Temporada óptima de consumo
5. Consejos de preparación si aplica

Por favor, sé específico y práctico en tus recomendaciones.`

    try {
      const response = await aiService.chat({ 
        prompt,
        system: "Eres un experto agrícola y nutricionista. Proporciona recomendaciones prácticas y útiles sobre productos agrícolas." 
      })
      return response.output_text
    } catch (error) {
      // Fallback cuando la IA no está disponible
      console.warn('IA no disponible, usando recomendaciones predeterminadas:', error)
      return getFallbackProductRecommendations(productName, category)
    }
  },

  /**
   * Obtener consejos de cultivo para un producto específico
   * @param productName - Nombre del producto
   * @param category - Categoría del producto
   * @returns Promesa con consejos de cultivo
   */
  getCultivationTips: async (productName: string, category: string): Promise<string> => {
    const prompt = `Proporciona consejos detallados para cultivar "${productName}" (${category}), incluyendo:

1. Condiciones de clima y suelo ideales
2. Temporada de siembra óptima
3. Riego y fertilización recomendada
4. Manejo de plagas y enfermedades comunes
5. Tiempo de cosecha y señales de madurez
6. Rendimiento esperado por hectárea

Sé específico y práctico.`

    try {
      const response = await aiService.chat({ 
        prompt,
        system: "Eres un experto agrónomo con años de experiencia en cultivos. Proporciona consejos prácticos y detallados." 
      })
      return response.output_text
    } catch (error) {
      // Fallback cuando la IA no está disponible
      console.warn('IA no disponible, usando consejos de cultivo predeterminados:', error)
      return getFallbackCultivationTips(productName, category)
    }
  }
}