import { describe, it, expect } from 'vitest'
import { DEPARTMENTS, MUNICIPALITIES, getMunicipalitiesByDepartment, getDepartmentById, getMunicipalityById } from '../services/locationService'

describe('LocationService', () => {
  describe('getMunicipalitiesByDepartment', () => {
    it('should return municipalities for a valid department', () => {
      const antioquiaMunicipalities = getMunicipalitiesByDepartment('05')
      expect(antioquiaMunicipalities.length).toBeGreaterThan(100) // Antioquia has many municipalities
      expect(antioquiaMunicipalities[0].name).toBe('Medellín')
      expect(antioquiaMunicipalities.every(m => m.department_id === '05')).toBe(true)
    })

    it('should return empty array for invalid department', () => {
      const result = getMunicipalitiesByDepartment('99')
      expect(result).toHaveLength(0)
    })

    it('should return empty array for empty department ID', () => {
      const result = getMunicipalitiesByDepartment('')
      expect(result).toHaveLength(0)
    })
  })

  describe('getDepartmentById', () => {
    it('should return department for valid ID', () => {
      const department = getDepartmentById('05')
      expect(department).toBeDefined()
      expect(department?.name).toBe('Antioquia')
    })

    it('should return undefined for invalid ID', () => {
      const department = getDepartmentById('XX')
      expect(department).toBeUndefined()
    })

    it('should return undefined for empty ID', () => {
      const department = getDepartmentById('')
      expect(department).toBeUndefined()
    })
  })

  describe('getMunicipalityById', () => {
    it('should return municipality for valid ID', () => {
      const municipality = getMunicipalityById('05001')
      expect(municipality).toBeDefined()
      expect(municipality?.name).toBe('Medellín')
      expect(municipality?.department_id).toBe('05')
    })

    it('should return undefined for invalid ID', () => {
      const municipality = getMunicipalityById('XXXXX')
      expect(municipality).toBeUndefined()
    })

    it('should return undefined for empty ID', () => {
      const municipality = getMunicipalityById('')
      expect(municipality).toBeUndefined()
    })
  })

  describe('Data integrity', () => {
    it('should have all departments with unique IDs', () => {
      const departmentIds = DEPARTMENTS.map(d => d.id)
      const uniqueIds = new Set(departmentIds)
      expect(uniqueIds.size).toBe(departmentIds.length)
    })

    it('should have all municipalities with unique IDs', () => {
      const municipalityIds = MUNICIPALITIES.map(m => m.id)
      const uniqueIds = new Set(municipalityIds)
      expect(uniqueIds.size).toBe(municipalityIds.length)
    })

    it('should have all municipalities referencing valid departments', () => {
      const departmentIds = new Set(DEPARTMENTS.map(d => d.id))
      const allMunicipalitiesValid = MUNICIPALITIES.every(m => departmentIds.has(m.department_id))
      expect(allMunicipalitiesValid).toBe(true)
    })

    it('should have major cities included', () => {
      const majorCities = ['Medellín', 'Bogotá', 'Cali', 'Ipiales', 'Pasto']
      const municipalityNames = MUNICIPALITIES.map(m => m.name)
      majorCities.forEach(city => {
        expect(municipalityNames).toContain(city)
      })
    })
  })
})