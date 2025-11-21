// Agricultural publication templates for different crop types

export interface PublicationTemplate {
  id: string
  name: string
  category: string
  description: string
  fields: {
    name: string
    description: string
    price: string
    quantity: string
    unit: string
    condition: 'new' | 'used' | 'seasonal'
    detailedDescription?: string
  }
  suggestedImages: string[]
  tips: string[]
  commonVarieties?: string[]
  seasonalInfo?: {
    planting: string
    harvest: string
  }
}

export const AGRICULTURAL_TEMPLATES: PublicationTemplate[] = [
  // Coffee template
  {
    id: 'coffee-template',
    name: 'Café',
    category: 'granos',
    description: 'Template para publicar café en grano o procesado',
    fields: {
      name: 'Café de Especialidad [Variedad]',
      description: 'Café de alta calidad, cultivado en [Región], con notas de [Sabores]',
      price: '12000',
      quantity: '12.5',
      unit: 'arroba',
      condition: 'new',
      detailedDescription: '<p><strong>Características del café:</strong></p><ul><li>Altitud: [Metros sobre el nivel del mar]</li><li>Variedad: [Caturra, Castillo, etc.]</li><li>Proceso: [Lavado, Natural, Honey]</li><li>Notas de sabor: [Chocolate, frutal, floral]</li><li>Secado: [Al sol, mecánico]</li></ul>'
    },
    suggestedImages: ['café-grano.jpg', 'café-planta.jpg', 'café-secado.jpg'],
    tips: [
      'Menciona la altitud del cultivo',
      'Indica el tipo de proceso (lavado, natural, honey)',
      'Especifica las notas de sabor',
      'Incluye información sobre el secado'
    ],
    commonVarieties: ['Caturra', 'Castillo', 'Colombia', 'Típica', 'Bourbón'],
    seasonalInfo: {
      planting: 'Octubre-Diciembre',
      harvest: 'Abril-Junio'
    }
  },
  
  // Banana template
  {
    id: 'banana-template',
    name: 'Plátano/Banano',
    category: 'frutas',
    description: 'Template para publicar plátano o banano',
    fields: {
      name: 'Plátano Verde [Variedad]',
      description: 'Plátano verde de alta calidad, ideal para fritar o cocinar',
      price: '2500',
      quantity: '25',
      unit: 'kg',
      condition: 'new',
      detailedDescription: '<p><strong>Características del plátano:</strong></p><ul><li>Estado: Verde (maduro en 5-7 días)</li><li>Variedad: [Dominico, Hartón, etc.]</li><li>Calibre: [Grande, mediano, pequeño]</li><li>Uso: Ideal para fritar, sancochado o madurar</li><li>Empacado: [Racimo, mano, unidad]</li></ul>'
    },
    suggestedImages: ['platano-verde.jpg', 'platano-racimo.jpg', 'platano-maduro.jpg'],
    tips: [
      'Especifica si es verde o maduro',
      'Indica la variedad (Dominico, Hartón, etc.)',
      'Menciona el calibre o tamaño',
      'Especifica la forma de empaque'
    ],
    commonVarieties: ['Dominico', 'Hartón', 'Gran Enano', 'Cavendish'],
    seasonalInfo: {
      planting: 'Todo el año',
      harvest: 'Todo el año'
    }
  },
  
  // Potato template
  {
    id: 'potato-template',
    name: 'Papa',
    category: 'tubérculos',
    description: 'Template para publicar papa de diferentes variedades',
    fields: {
      name: 'Papa [Variedad] de [Región]',
      description: 'Papa fresca, recién cosechada, de excelente calidad y sabor',
      price: '3500',
      quantity: '50',
      unit: 'kg',
      condition: 'new',
      detailedDescription: '<p><strong>Características de la papa:</strong></p><ul><li>Variedad: [Criolla, Pastusa, R-12, etc.]</li><li>Origen: [Boyacá, Nariño, Cundinamarca]</li><li>Calidad: [Extra, primera, segunda]</li><li>Tamaño: [Grande, mediano, pequeño, mezcla]</li><li>Uso: [Fritar, sancochar, hornear, cocer]</li></ul>'
    },
    suggestedImages: ['papa-criolla.jpg', 'papa-pastusa.jpg', 'papa-cosecha.jpg'],
    tips: [
      'Especifica la variedad (Criolla, Pastusa, R-12)',
      'Indica la región de origen',
      'Menciona la calidad (Extra, primera, segunda)',
      'Especifica el uso principal (fritar, sancochar)'
    ],
    commonVarieties: ['Criolla', 'Pastusa', 'R-12', 'Sabanera', 'Parda', 'Diacol-Capiro'],
    seasonalInfo: {
      planting: 'Enero-Marzo, Julio-Septiembre',
      harvest: 'Junio-Agosto, Diciembre-Febrero'
    }
  },
  
  // Rice template
  {
    id: 'rice-template',
    name: 'Arroz',
    category: 'granos',
    description: 'Template para publicar arroz en diferentes presentaciones',
    fields: {
      name: 'Arroz [Tipo] [Presentación]',
      description: 'Arroz de alta calidad, ideal para el consumo diario',
      price: '2800',
      quantity: '50',
      unit: 'kg',
      condition: 'new',
      detailedDescription: '<p><strong>Características del arroz:</strong></p><ul><li>Tipo: [Blanco, integral, parboiled]</li><li>Presentación: [Grano largo, grano corto, grano mediano]</li><li>Origen: [Tolima, Meta, Huila]</li><li>Proceso: [Pulido, semipulido, integral]</li><li>Calidad: [Extra, primera]</li></ul>'
    },
    suggestedImages: ['arroz-blanco.jpg', 'arroz-integral.jpg', 'arroz-saco.jpg'],
    tips: [
      'Especifica el tipo (blanco, integral, parboiled)',
      'Indica la presentación del grano',
      'Menciona la región de origen',
      'Especifica el proceso de elaboración'
    ],
    commonVarieties: ['Fedearroz 2000', 'Fedearroz 473', 'Oryzica 1', 'CT 21323'],
    seasonalInfo: {
      planting: 'Marzo-Mayo, Septiembre-Noviembre',
      harvest: 'Julio-Septiembre, Enero-Marzo'
    }
  },
  
  // Onion template
  {
    id: 'onion-template',
    name: 'Cebolla',
    category: 'verduras',
    description: 'Template para publicar cebolla cabezona o de rama',
    fields: {
      name: 'Cebolla [Tipo] [Color]',
      description: 'Cebolla fresca de excelente calidad, ideal para consumo',
      price: '3200',
      quantity: '25',
      unit: 'kg',
      condition: 'new',
      detailedDescription: '<p><strong>Características de la cebolla:</strong></p><ul><li>Tipo: [Cabezona, de rama, cambray]</li><li>Color: [Blanca, morada, amarilla]</li><li>Tamaño: [Grande, mediano, pequeño]</li><li>Presentación: [Saco, caja, atado]</li><li>Conservación: [Seca, fresca]</li></ul>'
    },
    suggestedImages: ['cebolla-blanca.jpg', 'cebolla-morada.jpg', 'cebolla-saco.jpg'],
    tips: [
      'Especifica el tipo (cabezona, de rama)',
      'Indica el color (blanca, morada, amarilla)',
      'Menciona el tamaño',
      'Especifica la presentación'
    ],
    commonVarieties: ['White Granex', 'Red Creole', 'Yellow Granex', 'Texas Grano'],
    seasonalInfo: {
      planting: 'Enero-Marzo, Agosto-Octubre',
      harvest: 'Mayo-Julio, Diciembre-Febrero'
    }
  },
  
  // Milk template
  {
    id: 'milk-template',
    name: 'Leche',
    category: 'lácteos',
    description: 'Template para publicar leche fresca o procesada',
    fields: {
      name: 'Leche [Tipo] [Presentación]',
      description: 'Leche fresca de alta calidad, ideal para consumo',
      price: '3500',
      quantity: '20',
      unit: 'l',
      condition: 'new',
      detailedDescription: '<p><strong>Características de la leche:</strong></p><ul><li>Tipo: [Entera, descremada, semidescremada]</li><li>Presentación: [Cruda, pasteurizada, UHT]</li><li>Origen: [Vaca, cabra, oveja]</li><li>Contenido graso: [3.5%, 2%, 0%]</li><li>Envase: [Botella, bolsa, garrafa]</li></ul>'
    },
    suggestedImages: ['leche-fresca.jpg', 'leche-garrafa.jpg', 'leche-botella.jpg'],
    tips: [
      'Especifica el tipo (entera, descremada)',
      'Indica la presentación (cruda, pasteurizada)',
      'Menciona el origen (vaca, cabra)',
      'Especifica el contenido graso'
    ],
    commonVarieties: ['Entera', 'Descremada', 'Semidescremada'],
    seasonalInfo: {
      planting: 'Todo el año',
      harvest: 'Todo el año'
    }
  },
  
  // Herbs template
  {
    id: 'herbs-template',
    name: 'Hierbas y Especias',
    category: 'hierbas',
    description: 'Template para publicar hierbas aromáticas y especias',
    fields: {
      name: '[Nombre] Fresca/Seca',
      description: '[Nombre] de alta calidad, ideal para cocinar y sazonar',
      price: '5000',
      quantity: '1',
      unit: 'kg',
      condition: 'new',
      detailedDescription: '<p><strong>Características de [nombre]:</strong></p><ul><li>Estado: [Fresco, seco, deshidratado]</li><li>Origen: [Cultivado, silvestre]</li><li>Presentación: [Ramo, picado, entero]</li><li>Aroma: [Intenso, medio, suave]</li><li>Conservación: [Refrigerado, ambiente, congelado]</li></ul>'
    },
    suggestedImages: ['cilantro-fresco.jpg', 'perejil-verde.jpg', 'albahaca.jpg'],
    tips: [
      'Especifica el estado (fresco, seco)',
      'Indica el origen (cultivado, silvestre)',
      'Menciona la presentación',
      'Describe el aroma'
    ],
    commonVarieties: ['Cilantro', 'Perejil', 'Albahaca', 'Romero', 'Tomillo', 'Orégano', 'Menta'],
    seasonalInfo: {
      planting: 'Todo el año',
      harvest: 'Todo el año'
    }
  }
]

// Get templates by category
export function getTemplatesByCategory(category: string): PublicationTemplate[] {
  return AGRICULTURAL_TEMPLATES.filter(template => template.category === category)
}

// Get template by ID
export function getTemplateById(id: string): PublicationTemplate | undefined {
  return AGRICULTURAL_TEMPLATES.find(template => template.id === id)
}

// Get all available templates
export function getAllTemplates(): PublicationTemplate[] {
  return AGRICULTURAL_TEMPLATES
}

// Apply template to form data
export function applyTemplate(template: PublicationTemplate, overrides: Partial<PublicationTemplate['fields']> = {}) {
  return {
    ...template.fields,
    ...overrides
  }
}

// Get template recommendations based on category and season
export function getTemplateRecommendations(category: string, currentMonth?: number): PublicationTemplate[] {
  const templates = getTemplatesByCategory(category)
  const month = currentMonth ?? new Date().getMonth()
  
  return templates.filter(template => {
    if (!template.seasonalInfo) return true
    
    const harvestMonths = template.seasonalInfo.harvest.split('-').map(m => {
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
      return monthNames.indexOf(m.toLowerCase())
    })
    
    if (harvestMonths.length === 2) {
      const [start, end] = harvestMonths
      return month >= start && month <= end
    }
    
    return true
  })
}