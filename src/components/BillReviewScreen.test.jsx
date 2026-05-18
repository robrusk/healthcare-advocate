import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BillReviewScreen from './BillReviewScreen'

const fakeBill = {
  provider_name: 'City Medical Center',
  billing_phone: '1-800-555-1234',
  bill_date: '2026-05-01',
  total_amount: '$55.00',
  patient_name: 'John Smith',
  account_number: 'ACC-12345',
  line_items: [
    { description: 'Blood draw fee', code: '36415', amount: '$55.00', flags: [] },
    { description: 'Lab services', code: null, amount: '$30.00', flags: ['missing_code', 'vague_description'] },
    { description: 'Office visit', code: '99213', amount: '$20.00', flags: ['possible_duplicate'] },
  ],
  missing_info: ['date of service', 'provider NPI number'],
  biller_error_detected: false,
  biller_error_description: null,
  plain_english: 'This bill is for a routine blood draw at your doctor\'s office.',
}

const billerErrorBill = {
  ...fakeBill,
  billing_phone: null,
  biller_error_detected: true,
  biller_error_description: 'Bill was submitted to the wrong insurance company first, causing a timely filing denial.',
}

describe('BillReviewScreen', () => {
  it('shows billing phone as tap-to-call when present', () => {
    render(<BillReviewScreen bill={fakeBill} onGenerate={vi.fn()} onSwitch={vi.fn()} />)
    expect(screen.getByText('1-800-555-1234')).toBeInTheDocument()
  })

  it('shows fallback message when phone is null', () => {
    render(<BillReviewScreen bill={billerErrorBill} onGenerate={vi.fn()} onSwitch={vi.fn()} />)
    expect(screen.getByText(/call the number on your bill/i)).toBeInTheDocument()
  })

  it('shows biller error warning when detected', () => {
    render(<BillReviewScreen bill={billerErrorBill} onGenerate={vi.fn()} onSwitch={vi.fn()} />)
    expect(screen.getByText(/this may not be your responsibility/i)).toBeInTheDocument()
    expect(screen.getByText(/billing error/i)).toBeInTheDocument()
  })

  it('does not show biller error warning when not detected', () => {
    render(<BillReviewScreen bill={fakeBill} onGenerate={vi.fn()} onSwitch={vi.fn()} />)
    expect(screen.queryByText(/this may not be your responsibility/i)).toBeNull()
  })

  it('renders plain English summary', () => {
    render(<BillReviewScreen bill={fakeBill} onGenerate={vi.fn()} onSwitch={vi.fn()} />)
    expect(screen.getByText(/routine blood draw/i)).toBeInTheDocument()
  })

  it('renders each line item description', () => {
    render(<BillReviewScreen bill={fakeBill} onGenerate={vi.fn()} onSwitch={vi.fn()} />)
    expect(screen.getByText('Blood draw fee')).toBeInTheDocument()
    expect(screen.getByText('Lab services')).toBeInTheDocument()
  })

  it('shows missing info box when info is missing', () => {
    render(<BillReviewScreen bill={fakeBill} onGenerate={vi.fn()} onSwitch={vi.fn()} />)
    expect(screen.getByText(/date of service/i)).toBeInTheDocument()
    expect(screen.getByText(/provider npi number/i)).toBeInTheDocument()
  })

  it('calls onGenerate when button is clicked', async () => {
    const onGenerate = vi.fn()
    render(<BillReviewScreen bill={fakeBill} onGenerate={onGenerate} onSwitch={vi.fn()} />)
    await userEvent.click(screen.getByText(/generate dispute letters/i))
    expect(onGenerate).toHaveBeenCalled()
  })

  it('calls onSwitch when switch link is clicked', async () => {
    const onSwitch = vi.fn()
    render(<BillReviewScreen bill={fakeBill} onGenerate={vi.fn()} onSwitch={onSwitch} />)
    await userEvent.click(screen.getByText(/switch to denial letter/i))
    expect(onSwitch).toHaveBeenCalled()
  })
})
