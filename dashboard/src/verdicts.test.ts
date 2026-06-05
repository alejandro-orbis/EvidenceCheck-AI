import { describe, it, expect } from 'vitest'
import { normalizeVerdict, normalizeConsensus } from './App'

describe('normalizeVerdict', () => {
  it('convierte VERDADERO a TRUE', () => {
    expect(normalizeVerdict('VERDADERO')).toBe('TRUE')
  })
  
  it('convierte FALSO a FALSE', () => {
    expect(normalizeVerdict('FALSO')).toBe('FALSE')
  })
  
  it('convierte EXAGERADO a EXAGGERATED', () => {
    expect(normalizeVerdict('EXAGERADO')).toBe('EXAGGERATED')
  })
  
  it('deja igual los valores en inglés', () => {
    expect(normalizeVerdict('TRUE')).toBe('TRUE')
    expect(normalizeVerdict('FALSE')).toBe('FALSE')
  })
})

describe('normalizeConsensus', () => {
  it('convierte FUERTE a STRONG', () => {
    expect(normalizeConsensus('FUERTE')).toBe('STRONG')
  })
  
  it('convierte MODERADO a MODERATE', () => {
    expect(normalizeConsensus('MODERADO')).toBe('MODERATE')
  })
  
  it('convierte MIXTO a MIXED', () => {
    expect(normalizeConsensus('MIXTO')).toBe('MIXED')
  })
})