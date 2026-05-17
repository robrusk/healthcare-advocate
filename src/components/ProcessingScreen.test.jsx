import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProcessingScreen from './ProcessingScreen'

describe('ProcessingScreen', () => {
  it('renders the photo thumbnail', () => {
    render(<ProcessingScreen photoUrl="blob:fake-url" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'blob:fake-url')
  })

  it('renders the reading message', () => {
    render(<ProcessingScreen photoUrl="blob:fake-url" />)
    expect(screen.getByText(/reading your denial letter/i)).toBeInTheDocument()
  })
})
