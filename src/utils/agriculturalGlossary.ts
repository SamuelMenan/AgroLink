// Agricultural glossary for Colombian farmers
export interface GlossaryTerm {
  term: string
  definition: string
  category: 'cultivation' | 'harvest' | 'storage' | 'certification' | 'measurement' | 'general'
  synonyms?: string[]
  examples?: string[]
  relatedTerms?: string[]
}

export const AGRICULTURAL_GLOSSARY: GlossaryTerm[] = [
  // Cultivation terms
  {
    term: 'siembra',
    definition: 'Proceso de colocar semillas en el suelo para que germinen y crezcan',
    category: 'cultivation',
    synonyms: ['plantación', 'siembra directa'],
    examples: ['La siembra de maíz se realiza en época de lluvias']
  },
  {
    term: 'cosecha',
    definition: 'Recolección de los productos agrícolas cuando han alcanzado su madurez',
    category: 'harvest',
    synonyms: ['recolección', 'recolecta'],
    examples: ['La cosecha de café se realiza cuando los granos están rojos']
  },
  {
    term: 'fertilización',
    definition: 'Aplicación de nutrientes al suelo para mejorar el crecimiento de las plantas',
    category: 'cultivation',
    synonyms: ['abonado', 'nutrición'],
    relatedTerms: ['abono', 'nutrientes']
  },
  {
    term: 'riego',
    definition: 'Aplicación controlada de agua a las plantas para su crecimiento',
    category: 'cultivation',
    synonyms: ['regar', 'irrigación'],
    examples: ['El riego por goteo es eficiente para cultivos intensivos']
  },
  
  // Harvest terms
  {
    term: 'madurez',
    definition: 'Estado en el que el producto agrícola está listo para ser cosechado',
    category: 'harvest',
    synonyms: ['maduro', 'óptimo'],
    examples: ['Los plátanos se cosechan en estado de madurez verde']
  },
  {
    term: 'rendimiento',
    definition: 'Cantidad de producto obtenido por unidad de área cultivada',
    category: 'harvest',
    synonyms: ['producción', 'productividad'],
    examples: ['El rendimiento de arroz es de 5 toneladas por hectárea']
  },
  {
    term: 'calidad',
    definition: 'Conjunto de características que determinan el valor del producto agrícola',
    category: 'harvest',
    examples: ['La calidad del café se mide por tamaño, color y aroma']
  },
  
  // Storage terms
  {
    term: 'almacenamiento',
    definition: 'Conservación de productos agrícolas en condiciones adecuadas',
    category: 'storage',
    synonyms: ['almacenaje', 'guarda'],
    relatedTerms: ['conservación', 'bodega']
  },
  {
    term: 'humedad',
    definition: 'Cantidad de agua presente en un producto agrícola',
    category: 'storage',
    examples: ['El grano de café debe tener máximo 12% de humedad']
  },
  {
    term: 'temperatura',
    definition: 'Grado de calor o frío necesario para conservar productos',
    category: 'storage',
    examples: ['Las papas se almacenan a 4-8°C']
  },
  
  // Certification terms
  {
    term: 'orgánico',
    definition: 'Producto cultivado sin pesticidas ni fertilizantes químicos sintéticos',
    category: 'certification',
    synonyms: ['ecológico', 'biológico'],
    examples: ['El café orgánico tiene certificación internacional']
  },
  {
    term: 'comercio justo',
    definition: 'Sistema de comercio que garantiza precios justos para productores',
    category: 'certification',
    synonyms: ['fair trade'],
    examples: ['El cacao de comercio justo paga precios dignos a los agricultores']
  },
  {
    term: 'certificación',
    definition: 'Proceso que garantiza que un producto cumple con estándares específicos',
    category: 'certification',
    relatedTerms: ['estándar', 'norma']
  },
  
  // Measurement terms
  {
    term: 'arroba',
    definition: 'Unidad de peso equivalente a 12.5 kilogramos',
    category: 'measurement',
    examples: ['Una arroba de café verde pesa 12.5 kg']
  },
  {
    term: 'fanega',
    definition: 'Unidad de medida agrícola equivalente a 6400 metros cuadrados',
    category: 'measurement',
    examples: ['Una fanega de tierra produce aproximadamente 2 toneladas de maíz']
  },
  {
    term: 'quintal',
    definition: 'Unidad de peso equivalente a 100 kilogramos',
    category: 'measurement',
    examples: ['Un quintal de arroz cuesta aproximadamente $200.000']
  },
  {
    term: 'tonelada',
    definition: 'Unidad de peso equivalente a 1000 kilogramos',
    category: 'measurement',
    examples: ['Una tonelada de plátano se vende al por mayor']
  },
  {
    term: 'hectárea',
    definition: 'Unidad de área equivalente a 10,000 metros cuadrados',
    category: 'measurement',
    examples: ['Una hectárea de cultivo de café tiene aproximadamente 2,000 plantas']
  },
  
  // General terms
  {
    term: 'agricultor',
    definition: 'Persona que se dedica a la agricultura y cultivo de la tierra',
    category: 'general',
    synonyms: ['campesino', 'granjero', 'productor'],
    examples: ['El agricultor cultiva maíz y frijoles en su finca']
  },
  {
    term: 'cultivo',
    definition: 'Planta que se siembra y cosecha para obtener productos agrícolas',
    category: 'general',
    synonyms: ['planta cultivada'],
    examples: ['El café es el cultivo más importante de Colombia']
  },
  {
    term: 'finca',
    definition: 'Terreno dedicado a la agricultura o ganadería',
    category: 'general',
    synonyms: ['granja', 'predio', 'fundo'],
    examples: ['La finca tiene 50 hectáreas dedicadas al cultivo de café']
  },
  {
    term: 'temporada',
    definition: 'Período del año adecuado para ciertas actividades agrícolas',
    category: 'general',
    examples: ['La temporada de lluvias es ideal para la siembra']
  },
  {
    term: 'suelo',
    definition: 'Capa superficial de la tierra donde crecen las plantas',
    category: 'general',
    synonyms: ['tierra', 'terreno'],
    relatedTerms: ['fertilidad', 'nutrientes']
  }
]

// Create a map for quick lookup
export const GLOSSARY_MAP = new Map(
  AGRICULTURAL_GLOSSARY.map(term => [term.term.toLowerCase(), term])
)

// Find term in glossary
export function findGlossaryTerm(searchTerm: string): GlossaryTerm | null {
  const normalizedSearch = searchTerm.toLowerCase().trim()
  
  // Direct match
  const directMatch = GLOSSARY_MAP.get(normalizedSearch)
  if (directMatch) return directMatch
  
  // Search in synonyms
  for (const term of AGRICULTURAL_GLOSSARY) {
    if (term.synonyms?.some(syn => syn.toLowerCase() === normalizedSearch)) {
      return term
    }
  }
  
  // Partial match (starts with)
  const partialMatch = AGRICULTURAL_GLOSSARY.find(term => 
    term.term.toLowerCase().startsWith(normalizedSearch) ||
    term.synonyms?.some(syn => syn.toLowerCase().startsWith(normalizedSearch))
  )
  
  return partialMatch || null
}

// Get terms by category
export function getGlossaryByCategory(category: GlossaryTerm['category']): GlossaryTerm[] {
  return AGRICULTURAL_GLOSSARY.filter(term => term.category === category)
}

// Search terms by keyword
export function searchGlossary(keyword: string): GlossaryTerm[] {
  const normalizedKeyword = keyword.toLowerCase().trim()
  
  return AGRICULTURAL_GLOSSARY.filter(term => 
    term.term.toLowerCase().includes(normalizedKeyword) ||
    term.definition.toLowerCase().includes(normalizedKeyword) ||
    term.synonyms?.some(syn => syn.toLowerCase().includes(normalizedKeyword)) ||
    term.examples?.some(ex => ex.toLowerCase().includes(normalizedKeyword))
  )
}

// Get related terms
export function getRelatedTerms(term: string): GlossaryTerm[] {
  const foundTerm = findGlossaryTerm(term)
  if (!foundTerm || !foundTerm.relatedTerms) return []
  
  return foundTerm.relatedTerms
    .map(related => findGlossaryTerm(related))
    .filter(Boolean) as GlossaryTerm[]
}