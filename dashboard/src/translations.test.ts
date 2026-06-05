import { describe, it, expect } from 'vitest'
import { TRANSLATIONS } from './App'

describe('Traducciones ES/EN', () => {
  it('tiene las mismas claves en ambos idiomas', () => {
    const esKeys = Object.keys(TRANSLATIONS.es)
    const enKeys = Object.keys(TRANSLATIONS.en)
    expect(esKeys).toEqual(enKeys)
  })

  it('los textos en español son diferentes a los de inglés', () => {
    expect(TRANSLATIONS.es.verdict).not.toBe(TRANSLATIONS.en.verdict)
    expect(TRANSLATIONS.es.confidence).not.toBe(TRANSLATIONS.en.confidence)
    expect(TRANSLATIONS.es.consensus).not.toBe(TRANSLATIONS.en.consensus)
  })

  it('contiene las etiquetas de consenso esperadas', () => {
    expect(TRANSLATIONS.es.consensusLabels).toBeDefined()
    expect(TRANSLATIONS.en.consensusLabels).toBeDefined()
  })
})