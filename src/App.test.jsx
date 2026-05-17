import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

vi.mock('./lib/claude', () => ({
  analyzeDenialLetter: vi.fn().mockResolvedValue({
    analysis: 'Your claim was denied.',
    letter: 'Dear Insurance Company…',
  }),
  fileToBase64: vi.fn().mockResolvedValue('fakebase64'),
}))

describe('App', () => {
  it('starts on the capture screen', () => {
    render(<App />)
    expect(screen.getByText(/photograph denial letter/i)).toBeInTheDocument()
  })

  it('shows processing screen after a photo is selected', async () => {
    const { analyzeDenialLetter } = await import('./lib/claude')
    let resolveAnalysis
    analyzeDenialLetter.mockImplementationOnce(
      () => new Promise((resolve) => { resolveAnalysis = resolve })
    )

    render(<App />)
    const file = new File(['img'], 'denial.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    expect(screen.getByText(/reading your denial letter/i)).toBeInTheDocument()
    resolveAnalysis({ analysis: 'a', letter: 'b' })
  })

  it('shows results screen after processing completes', async () => {
    render(<App />)
    const file = new File(['img'], 'denial.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)
    await waitFor(() => {
      expect(screen.getByText(/what this denial means/i)).toBeInTheDocument()
    })
  })

  it('returns to capture screen when Start Over is clicked', async () => {
    render(<App />)
    const file = new File(['img'], 'denial.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)
    await waitFor(() => screen.getByText(/start over/i))
    await userEvent.click(screen.getByText(/start over/i))
    expect(screen.getByText(/photograph denial letter/i)).toBeInTheDocument()
  })
})
