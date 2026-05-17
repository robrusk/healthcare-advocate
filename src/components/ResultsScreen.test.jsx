import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResultsScreen from './ResultsScreen'

const fakeResult = {
  analysis: 'Your claim was denied because the insurer said it was not medically necessary.',
  letter: 'Dear Insurance Company, I am writing to formally appeal this denial.',
}

describe('ResultsScreen', () => {
  it('renders the analysis card', () => {
    render(<ResultsScreen result={fakeResult} onReset={vi.fn()} />)
    expect(screen.getByText(/what this denial means/i)).toBeInTheDocument()
    expect(screen.getByText(fakeResult.analysis)).toBeInTheDocument()
  })

  it('renders the appeal letter card', () => {
    render(<ResultsScreen result={fakeResult} onReset={vi.fn()} />)
    expect(screen.getByText(/your appeal letter/i)).toBeInTheDocument()
    expect(screen.getByText(fakeResult.letter)).toBeInTheDocument()
  })

  it('copies the letter to clipboard on button click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ResultsScreen result={fakeResult} onReset={vi.fn()} />)
    await userEvent.click(screen.getByText(/copy to clipboard/i))

    expect(writeText).toHaveBeenCalledWith(fakeResult.letter)
  })

  it('calls onReset when Start Over is clicked', async () => {
    const onReset = vi.fn()
    render(<ResultsScreen result={fakeResult} onReset={onReset} />)
    await userEvent.click(screen.getByText(/start over/i))
    expect(onReset).toHaveBeenCalled()
  })
})
