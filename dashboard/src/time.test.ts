import { describe, it, expect, vi } from 'vitest'

// Copia la función getElapsedTime de App.tsx (o impórtala)
function getElapsedTime(createdAt: string) {
  if (!createdAt) return ''
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  if (elapsed < 60) return ` (${elapsed}s)`
  return ` (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`
}

describe('getElapsedTime', () => {
  it('devuelve string vacío si no hay createdAt', () => {
    expect(getElapsedTime('')).toBe('')
  })

  it('formatea segundos correctamente', () => {
    const ahora = Date.now()
    const hace30s = new Date(ahora - 30 * 1000).toISOString()
    expect(getElapsedTime(hace30s)).toContain('30s')
  })

  it('formatea minutos correctamente', () => {
    const ahora = Date.now()
    const hace2min = new Date(ahora - 2 * 60 * 1000).toISOString()
    const result = getElapsedTime(hace2min)
    expect(result).toContain('2m')
  })
})