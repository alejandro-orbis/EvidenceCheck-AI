import { describe, it, expect } from 'vitest'

function badgeClass(value: string) {
  return String(value).toLowerCase().replaceAll('_', '-')
}

describe('badgeClass', () => {
  it('convierte a minúsculas', () => {
    expect(badgeClass('COMPLETED')).toBe('completed')
  })

  it('reemplaza guiones bajos por guiones', () => {
    expect(badgeClass('EVIDENCIA_INSUFICIENTE')).toBe('evidencia-insuficiente')
  })
})