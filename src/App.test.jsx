import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

vi.mock('./lib/claude', () => ({
  analyzePhoto: vi.fn().mockResolvedValue({
    plain_english: 'Your claim was denied.',
    denial_reason: 'not_medically_necessary',
    patient_name: 'Jane Smith',
    claim_number: 'CLM-001',
    insurer_name: 'Test Insurance',
    treatment: 'MRI',
  }),
  analyzeDenial: vi.fn().mockResolvedValue({
    plan_type: 'employer_erisa',
    denial_reason: 'medical_necessity',
    appeal_level: 'first_internal',
    confidence: {},
  }),
  fileToBase64: vi.fn().mockResolvedValue('fakebase64'),
}))

describe('App', () => {
  it('renders the camera and PDF upload buttons', () => {
    render(<App />)
    expect(screen.getByText(/take photo/i)).toBeInTheDocument()
    expect(screen.getByText(/upload pdf/i)).toBeInTheDocument()
  })

  it('renders the submitter relationship selector', () => {
    render(<App />)
    expect(screen.getByText(/the patient/i)).toBeInTheDocument()
    expect(screen.getByText(/spouse/i)).toBeInTheDocument()
  })

  it('shows plain-English summary after photo upload', async () => {
    render(<App />)
    const file = new File(['img'], 'denial.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)
    await waitFor(() => {
      expect(screen.getByText(/your claim was denied/i)).toBeInTheDocument()
    })
  })

  it('renders the analyze button when a denial reason is selected', async () => {
    render(<App />)
    const file = new File(['img'], 'denial.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)
    await waitFor(() => screen.getByText(/analyze my denial/i))
    expect(screen.getByText(/analyze my denial/i)).toBeInTheDocument()
  })
})
