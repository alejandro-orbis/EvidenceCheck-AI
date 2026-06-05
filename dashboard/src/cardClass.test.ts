import { describe, it, expect } from 'vitest'

function normalizeVerdict(verdict: string | null | undefined) {
  const key = String(verdict || '').trim().toUpperCase()
  const map: Record<string, string> = {
    VERDADERO: 'TRUE',
    TRUE: 'TRUE',
    FALSO: 'FALSE',
    FALSE: 'FALSE',
    EXAGERADO: 'EXAGGERATED',
    EXAGGERATED: 'EXAGGERATED',
    EVIDENCIA_INSUFICIENTE: 'INSUFFICIENT_EVIDENCE'
  }
  return map[key] || key
}

function verdictCardClass(verdict: string | null | undefined, status: string) {
  if (status === 'processing') return 'card-processing'
  if (!verdict) return ''
  return 'card-' + normalizeVerdict(verdict).toLowerCase().replaceAll('_', '-')
}

describe('verdictCardClass', () => {
  it('devuelve card-processing para estado processing', () => {
    expect(verdictCardClass('VERDADERO', 'processing')).toBe('card-processing')
  })

  it('devuelve clase correcta para VERDADERO', () => {
    expect(verdictCardClass('VERDADERO', 'completed')).toBe('card-true')
  })

  it('devuelve clase correcta para FALSO', () => {
    expect(verdictCardClass('FALSO', 'completed')).toBe('card-false')
  })
})