import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    'anthropic-beta': 'pdfs-2024-09-25',
  },
})

const VALID_PLAN_TYPES = [
  'employer_erisa',
  'aca_marketplace',
  'medicare_advantage',
  'original_medicare',
  'medicaid',
  'fehb',
  'unclear',
]

const VALID_DENIAL_REASONS = [
  'medical_necessity',
  'experimental',
  'out_of_network',
  'not_covered',
  'prior_auth_missing',
  'step_therapy',
  'other',
]

const VALID_APPEAL_LEVELS = [
  'first_internal',
  'second_internal',
  'external_review',
  'unclear',
]

const DENIAL_REASON_IDS = [
  'not_medically_necessary',
  'experimental',
  'prior_auth',
  'out_of_network',
  'coding_error',
  'duplicate_claim',
  'benefit_limit',
  'not_covered',
  'timely_filing',
  'other',
]

const EXTRACTION_PROMPT = `You are a structured data extraction system. Read this insurance denial letter and return ONLY a JSON object — no preamble, no explanation, nothing else.

Extract exactly these fields:

{
  "insurer_name": "Insurance company name, or null",
  "plan_type": "One of: employer_erisa, aca_marketplace, medicare_advantage, original_medicare, medicaid, fehb, unclear",
  "denial_reason": "One of: medical_necessity, experimental, out_of_network, not_covered, prior_auth_missing, step_therapy, other",
  "service_denied": "Short description of the denied treatment or service, or null",
  "diagnosis_code": "ICD-10 code if present, or null",
  "billed_amount": "Dollar amount as string if present, or null",
  "appeal_deadline": "ISO 8601 date (YYYY-MM-DD) if determinable, or null",
  "appeal_level": "One of: first_internal, second_internal, external_review, unclear",
  "state": "2-letter US state code if determinable, or null",
  "patient_name": "Patient name if present, or null",
  "claim_number": "Claim or reference number if present, or null",
  "confidence": {
    "plan_type": "high, medium, or low",
    "denial_reason": "high, medium, or low",
    "appeal_deadline": "high, medium, or low",
    "state": "high, medium, or low"
  }
}

CRITICAL RULES:
- Return JSON ONLY. No text before or after the JSON object.
- If a field is not clearly stated in the letter, return null.
- Do not guess. Do not invent. "unclear" and null are correct answers.
- For plan_type: employer insurance = employer_erisa, marketplace/exchange = aca_marketplace, Medicare HMO/PPO = medicare_advantage, traditional Medicare = original_medicare.
- For confidence: high = explicitly stated, medium = reasonably inferred, low = guessed.`

const PHOTO_PROMPT = `You are a patient advocate helping a family member understand and fight a health insurance denial letter.

Look at this denial letter and respond with a JSON object containing these fields:

{
  "plain_english": "Explain what this denial means in 3-5 warm, simple sentences written for a 75-year-old who has never dealt with insurance paperwork before. No jargon. Tell them exactly what was denied, why the insurance company says they denied it, and that they have every right to fight back.",
  "denial_reason": "Pick the single best match from this exact list: not_medically_necessary, experimental, prior_auth, out_of_network, coding_error, duplicate_claim, benefit_limit, not_covered, timely_filing, other",
  "patient_name": "Patient name from the letter, or empty string if not visible",
  "claim_number": "Claim or reference number from the letter, or empty string if not visible",
  "insurer_name": "Insurance company name from the letter, or empty string if not visible",
  "treatment": "The treatment, service, or medication that was denied, or empty string if not visible"
}

Respond with ONLY the JSON object. No other text.`

function fileContent(imageBase64, mediaType) {
  return mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } }
}

// Pass 1 — narrow extraction. Uses Haiku (cheap/fast). Returns structured JSON only.
export async function analyzeDenial(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          fileContent(imageBase64, mediaType),
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  })

  const parsed = JSON.parse(response.content[0].text)

  // Sanitize enum fields — fall back to 'unclear' / 'other' if model returns garbage
  if (!VALID_PLAN_TYPES.includes(parsed.plan_type)) parsed.plan_type = 'unclear'
  if (!VALID_DENIAL_REASONS.includes(parsed.denial_reason)) parsed.denial_reason = 'other'
  if (!VALID_APPEAL_LEVELS.includes(parsed.appeal_level)) parsed.appeal_level = 'unclear'

  return parsed
}

// Plain-English summary + basic field extraction for the upload step preview
export async function analyzePhoto(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [fileContent(imageBase64, mediaType), { type: 'text', text: PHOTO_PROMPT }],
      },
    ],
  })

  const parsed = JSON.parse(response.content[0].text)
  if (!DENIAL_REASON_IDS.includes(parsed.denial_reason)) {
    parsed.denial_reason = 'other'
  }
  return parsed
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
