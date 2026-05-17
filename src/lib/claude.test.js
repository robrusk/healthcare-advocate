import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeDenialLetter, fileToBase64 } from './claude'

// vi.hoisted runs before imports and before mock factories,
// so mockCreate is available inside the vi.mock factory below.
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    this.messages = { create: mockCreate }
  }),
}))

describe('analyzeDenialLetter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns analysis and letter from Claude response', async () => {
    const fakeResponse = {
      analysis: 'Your claim was denied because the insurer said it was not medically necessary.',
      letter: 'Dear Insurance Company, I am writing to formally appeal...',
    }
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(fakeResponse) }],
    })

    const result = await analyzeDenialLetter('base64data', 'image/jpeg')

    expect(result.analysis).toBe(fakeResponse.analysis)
    expect(result.letter).toBe(fakeResponse.letter)
  })

  it('calls Claude with the correct model and image', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ analysis: 'a', letter: 'b' }) }],
    })

    await analyzeDenialLetter('mybase64', 'image/jpeg')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-7',
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'image',
                source: expect.objectContaining({
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: 'mybase64',
                }),
              }),
            ]),
          }),
        ]),
      })
    )
  })

  it('throws if Claude response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: 'not json' }],
    })

    await expect(analyzeDenialLetter('base64data', 'image/jpeg')).rejects.toThrow()
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
