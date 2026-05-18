import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FactsUsedCard } from './FactsUsedCard'

const fakeCitations = [
  {
    title: 'Medicare Advantage Medical Necessity Standards',
    summary: 'CMS rules requiring MA plans to cover medically necessary services.',
    source: '42 C.F.R. § 422.101, CMS Medicare Managed Care Manual Chapter 4',
    updated: '2026',
  },
  {
    title: 'Colorado State Rules',
    summary: 'Colorado-specific insurance protections.',
    source: 'Colorado Insurance Code',
    updated: '2026',
  },
]

describe('FactsUsedCard', () => {
  it('renders nothing when citations array is empty', () => {
    const { container } = render(<FactsUsedCard citations={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when citations is null', () => {
    const { container } = render(<FactsUsedCard citations={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the verified sources heading', () => {
    render(<FactsUsedCard citations={fakeCitations} />)
    expect(screen.getByText(/verified sources used/i)).toBeInTheDocument()
  })

  it('renders each citation title', () => {
    render(<FactsUsedCard citations={fakeCitations} />)
    expect(screen.getByText('Medicare Advantage Medical Necessity Standards')).toBeInTheDocument()
    expect(screen.getByText('Colorado State Rules')).toBeInTheDocument()
  })

  it('renders each citation summary', () => {
    render(<FactsUsedCard citations={fakeCitations} />)
    expect(screen.getByText('CMS rules requiring MA plans to cover medically necessary services.')).toBeInTheDocument()
  })

  it('renders the privacy notice', () => {
    render(<FactsUsedCard citations={fakeCitations} />)
    expect(screen.getByText(/no private data left your device/i)).toBeInTheDocument()
  })
})
