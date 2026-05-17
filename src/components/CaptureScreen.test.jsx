import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CaptureScreen from './CaptureScreen'

describe('CaptureScreen', () => {
  it('renders the camera button', () => {
    render(<CaptureScreen onCapture={vi.fn()} />)
    expect(screen.getByText(/photograph denial letter/i)).toBeInTheDocument()
  })

  it('calls onCapture with the selected file', async () => {
    const onCapture = vi.fn()
    render(<CaptureScreen onCapture={onCapture} />)

    const file = new File(['fake image'], 'denial.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    expect(onCapture).toHaveBeenCalledWith(file)
  })
})
