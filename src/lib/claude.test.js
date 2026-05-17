import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeDenial, analyzePhoto, fileToBase64 } from './claude'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    this.messages = { create: mockCreate }
  }),
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
