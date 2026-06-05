import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('App', () => {
  it('renderiza el título correctamente', () => {
    render(<App />)
    expect(screen.getByText(/EvidenceCheck AI/i)).toBeDefined()
  })

  it('tiene los botones de idioma ES/EN', async () => {
    render(<App />)
    // Espera a que los botones aparezcan (por si hay alguna actualización asíncrona)
    await waitFor(() => {
      expect(screen.getByText('🇪🇸 ES')).toBeDefined()
      expect(screen.getByText('🇬🇧 EN')).toBeDefined()
    })
  })
})