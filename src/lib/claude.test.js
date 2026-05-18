import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeDenial, analyzePhoto, fileToBase64, analyzeMedicalBill } from './claude'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

// claude.js calls fetch() to the Cloudflare Worker proxy, not the Anthropic SDK directly.
// mockCreate is called with the parsed request body and returns the fake Claude response,
// so existing assertions on mockCreate.toHaveBeenCalledWith(...) still work.
vi.stubGlobal('fetch', vi.fn(async (_url, opts) => {
  const body = JSON.parse(opts.body)
  const result = await mockCreate(body)
  return {
    ok: true,
    json: () => Promise.resolve(result),
    text: () => Promise.resolve(''),
  }
}))

describe('analyzeDenial', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns structured extraction from Claude response', async () => {
    const fakeExtraction = {
      insurer_name: 'Meridian Health Assurance',
      plan_type: 'employer_erisa',
      denial_reason: 'medical_necessity',
      service_denied: 'Pembrolizumab infusion',
      diagnosis_code: 'C34.31',
      billed_amount: '$28,447.16',
      appeal_deadline: '2026-10-11',
      appeal_level: 'first_internal',
      state: 'CT',
      patient_name: 'Sample Patient',
      claim_number: 'CLM-9938472-01',
      confidence: { plan_type: 'medium', denial_reason: 'high', appeal_deadline: 'high', state: 'high' },
    }
    mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify(fakeExtraction) }] })

    const result = await analyzeDenial('base64data', 'image/jpeg')

    expect(result.insurer_name).toBe('Meridian Health Assurance')
    expect(result.plan_type).toBe('employer_erisa')
    expect(result.denial_reason).toBe('medical_necessity')
    expect(result.appeal_deadline).toBe('2026-10-11')
    expect(result.confidence.denial_reason).toBe('high')
  })

  it('uses the Haiku model', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ plan_type: 'employer_erisa', denial_reason: 'medical_necessity', appeal_level: 'first_internal', confidence: {} }) }],
    })

    await analyzeDenial('mybase64', 'image/jpeg')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' })
    )
  })

  it('falls back plan_type to unclear when model returns invalid value', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ plan_type: 'made_up_value', denial_reason: 'medical_necessity', appeal_level: 'first_internal', confidence: {} }) }],
    })

    const result = await analyzeDenial('base64data', 'image/jpeg')
    expect(result.plan_type).toBe('unclear')
  })

  it('falls back denial_reason to other when model returns invalid value', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ plan_type: 'employer_erisa', denial_reason: 'invented_reason', appeal_level: 'first_internal', confidence: {} }) }],
    })

    const result = await analyzeDenial('base64data', 'image/jpeg')
    expect(result.denial_reason).toBe('other')
  })

  it('sends PDF as document type, not image', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ plan_type: 'employer_erisa', denial_reason: 'medical_necessity', appeal_level: 'first_internal', confidence: {} }) }],
    })

    await analyzeDenial('pdfbase64', 'application/pdf')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'document' }),
            ]),
          }),
        ]),
      })
    )
  })

  it('throws if response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ text: 'not json' }] })
    await expect(analyzeDenial('base64data', 'image/jpeg')).rejects.toThrow()
  })
})

describe('fileToBase64', () => {
  it('returns the base64 data portion of the file', async () => {
    const blob = new Blob(['hello'], { type: 'image/jpeg' })
    const file = new File([blob], 'test.jpg', { type: 'image/jpeg' })

    const result = await fileToBase64(file)

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toContain('data:image/jpeg;base64,')
  })
})

describe('analyzeMedicalBill', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns structured bill data from Claude response', async () => {
    const fakeBill = {
      provider_name: 'City Medical Center',
      billing_phone: '1-800-555-1234',
      bill_date: '2026-05-01',
      total_amount: '$55.00',
      patient_name: 'John Smith',
      account_number: 'ACC-12345',
      line_items: [
        { description: 'Blood draw fee', code: '36415', amount: '$55.00', flags: [] }
      ],
      missing_info: [],
      biller_error_detected: false,
      biller_error_description: null,
      plain_english: 'This bill is for a routine blood draw.',
    }
    mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify(fakeBill) }] })

    const result = await analyzeMedicalBill('base64data', 'application/pdf')

    expect(result.provider_name).toBe('City Medical Center')
    expect(result.billing_phone).toBe('1-800-555-1234')
    expect(result.line_items).toHaveLength(1)
    expect(result.biller_error_detected).toBe(false)
  })

  it('detects biller error when flagged', async () => {
    const fakeBill = {
      provider_name: 'City Medical Center',
      billing_phone: null,
      bill_date: null,
      total_amount: '$200.00',
      patient_name: null,
      account_number: null,
      line_items: [],
      missing_info: ['date of service'],
      biller_error_detected: true,
      biller_error_description: 'This is a billing error: bill was submitted to wrong insurer first, causing timely filing denial.',
      plain_english: 'This bill appears to result from a billing error.',
    }
    mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify(fakeBill) }] })

    const result = await analyzeMedicalBill('base64data', 'image/jpeg')

    expect(result.biller_error_detected).toBe(true)
    expect(result.biller_error_description).toContain('billing error')
  })

  it('normalizes missing arrays to empty arrays', async () => {
    const fakeBill = {
      provider_name: null, billing_phone: null, bill_date: null,
      total_amount: null, patient_name: null, account_number: null,
      biller_error_detected: false, biller_error_description: null,
      plain_english: 'Could not fully read this bill.',
    }
    mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify(fakeBill) }] })

    const result = await analyzeMedicalBill('base64data', 'image/jpeg')

    expect(result.line_items).toEqual([])
    expect(result.missing_info).toEqual([])
  })

  it('throws if response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ text: 'not json' }] })
    await expect(analyzeMedicalBill('base64data', 'image/jpeg')).rejects.toThrow()
  })
})
