import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const PROMPT = `You are a patient advocate helping a family member fight a health insurance denial.

Analyze this denial letter and respond with a JSON object containing exactly two fields:

{
  "analysis": "A plain-English explanation of what was denied and why, written in 3-5 sentences for a stressed, non-expert family member. No medical or legal jargon. Use warm, clear language.",
  "letter": "A complete formal appeal letter. Include: 1) A header with patient name, claim number, and insurance company name extracted from the letter — use [INSERT: ___] for anything you cannot read clearly. 2) An opening sentence stating this is a formal appeal of an adverse benefit determination. 3) A restatement of the denial reason and a clear argument against it with clinical and legal basis. 4) A specific request to overturn the denial and respond within the legally required timeframe. 5) A closing with the patient or caregiver name and contact information — use [INSERT: ___] for anything not visible in the letter."
}

Respond with ONLY the JSON object. No other text before or after it.`

export async function analyzeDenialLetter(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: PROMPT,
          },
        ],
      },
    ],
  })

  return JSON.parse(response.content[0].text)
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
