import { describe, it, expect } from 'vitest'

const mockJobs = [
  { status: 'completed', articles_count: 5 },
  { status: 'completed', articles_count: 3 },
  { status: 'processing', articles_count: 2 },
  { status: 'failed', articles_count: 0 }
]

describe('Cálculo de KPIs', () => {
  it('calcula el total correctamente', () => {
    expect(mockJobs.length).toBe(4)
  })

  it('cuenta los completados correctamente', () => {
    const completed = mockJobs.filter(j => j.status === 'completed').length
    expect(completed).toBe(2)
  })

  it('suma los artículos correctamente', () => {
    const totalArticles = mockJobs.reduce((sum, j) => sum + j.articles_count, 0)
    expect(totalArticles).toBe(10)
  })
})