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

  describe('Anything else we should know? box', () => {
    // Walk the denial flow to the confirm screen, optionally type extra details,
    // click Draft, and return the prompts sent for the three letters.
    async function draftLetters(extra) {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: 'LETTER' }] }),
      })
      vi.stubGlobal('fetch', fetchMock)
      render(<App />)
      await userEvent.upload(document.querySelector('input[type="file"]'), new File(['img'], 'd.jpg', { type: 'image/jpeg' }))
      await userEvent.click(await screen.findByText('Not Medically Necessary'))
      await userEvent.click(screen.getByText(/analyze my denial/i))
      const box = await screen.findByLabelText(/anything else we should know/i, {}, { timeout: 4000 })
      if (extra) await userEvent.type(box, extra)
      await userEvent.click(screen.getByText(/draft my appeal/i))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
      vi.unstubAllGlobals()
      return fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).messages[0].content)
    }

    it('adds the typed details to all three letter prompts', async () => {
      const prompts = await draftLetters("I've taken this medicine for 6 years.")
      expect(prompts).toHaveLength(3)
      for (const p of prompts) {
        expect(p).toContain("<patient_added_details>\nI've taken this medicine for 6 years.\n</patient_added_details>")
        expect(p).toContain('Never invent dates, doctors, test results, or medical history')
      }
    })

    it('leaves the letters unchanged when the box is empty', async () => {
      const prompts = await draftLetters('')
      expect(prompts).toHaveLength(3)
      for (const p of prompts) expect(p).not.toContain('patient_added_details')
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
