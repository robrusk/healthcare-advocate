import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

vi.mock('./lib/claude', () => ({
  analyzePhoto: vi.fn().mockResolvedValue({
    plain_english: 'Your claim was denied.',
    document_type: 'denial_letter',
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
  analyzeMedicalBill: vi.fn().mockResolvedValue({
    line_items: [],
    missing_info: [],
    biller_error_detected: false,
    biller_error_description: null,
    plain_english: 'This bill is for routine services.',
  }),
  fileToBase64: vi.fn().mockResolvedValue('fakebase64'),
}))

describe('App', () => {
  it('renders the Fight a Denial card on load', () => {
    render(<App />)
    expect(screen.getByText(/fight a denial/i)).toBeInTheDocument()
  })

  it('renders the Review a Bill card on load', () => {
    render(<App />)
    expect(screen.getByText(/review a bill/i)).toBeInTheDocument()
  })

  it('renders the not-sure fallback link', () => {
    render(<App />)
    expect(screen.getByText(/not sure what you have/i)).toBeInTheDocument()
  })

  it('shows the summary after a photo is uploaded', async () => {
    render(<App />)
    const file = new File(['img'], 'denial.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)
    await waitFor(() => {
      expect(screen.getByText(/your claim was denied/i)).toBeInTheDocument()
    })
  })

  it('renders the submitter relationship selector after photo upload', async () => {
    render(<App />)
    const file = new File(['img'], 'denial.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)
    await waitFor(() => screen.getByText(/the patient/i))
    expect(screen.getByText(/the patient/i)).toBeInTheDocument()
  })
})
