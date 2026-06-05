import { describe, it, expect } from 'vitest'

const mockJobs = [
  { claim: 'La vitamina D cura el cáncer', verdict: 'EXAGERADO', summary: 'No hay pruebas sólidas' },
  { claim: 'El café previene el Parkinson', verdict: 'VERDADERO', summary: 'Estudios observacionales' }
]

function filterJobs(jobs: any[], term: string) {
  if (!term) return jobs
  const lowerTerm = term.toLowerCase()
  return jobs.filter(job =>
    job.claim.toLowerCase().includes(lowerTerm) ||
    job.verdict.toLowerCase().includes(lowerTerm) ||
    job.summary.toLowerCase().includes(lowerTerm)
  )
}

describe('Filtro de búsqueda', () => {
  it('devuelve todos los jobs si searchTerm está vacío', () => {
    expect(filterJobs(mockJobs, '')).toEqual(mockJobs)
  })

  it('filtra por claim', () => {
    const filtered = filterJobs(mockJobs, 'vitamina')
    expect(filtered.length).toBe(1)
    expect(filtered[0].claim).toContain('vitamina')
  })

  it('filtra por veredicto', () => {
    const filtered = filterJobs(mockJobs, 'VERDADERO')
    expect(filtered.length).toBe(1)
    expect(filtered[0].verdict).toBe('VERDADERO')
  })
})