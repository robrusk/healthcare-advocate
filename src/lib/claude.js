// All Claude API calls route through the Cloudflare Worker proxy.
// The API key lives in the worker — never in the browser.
const WORKER_URL = 'https://icy-silence-e717.rob-3ea.workers.dev/'

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
- Return JSON ONLY. No markdown code fences. No text before or after the JSON object.
- If a field is not clearly stated in the letter, return null.
- Do not guess. Do not invent. "unclear" and null are correct answers.
- For plan_type: employer insurance = employer_erisa, marketplace/exchange = aca_marketplace, Medicare HMO/PPO = medicare_advantage, traditional Medicare = original_medicare.
- For confidence: high = explicitly stated, medium = reasonably inferred, low = guessed.`

const PHOTO_PROMPT = `You are a patient advocate helping a family member understand and fight a health insurance denial letter.

Look at this denial letter and respond with a JSON object containing these fields:

{
  "plain_english": "Explain what this denial means in 3-5 warm, simple sentences written for a 75-year-old who has never dealt with insurance paperwork before. No jargon. Tell them exactly what was denied, why the insurance company says they denied it, and that they have every right to fight back.",
  "document_type": "One of: denial_letter or medical_bill — infer from the document content",
  "denial_reason": "Pick the single best match from this exact list: not_medically_necessary, experimental, prior_auth, out_of_network, coding_error, duplicate_claim, benefit_limit, not_covered, timely_filing, other",
  "patient_name": "Patient name from the letter, or empty string if not visible",
  "claim_number": "Claim or reference number from the letter, or empty string if not visible",
  "insurer_name": "Insurance company name from the letter, or empty string if not visible",
  "treatment": "The treatment, service, or medication that was denied, or empty string if not visible"
}

Respond with ONLY the raw JSON object. No markdown code fences. No other text.`

const MEDICAL_BILL_PROMPT = `You are a medical billing expert helping a patient understand and dispute their medical bill.

Read this medical bill carefully and return ONLY a raw JSON object. No markdown code fences. No other text.

{
  "provider_name": "provider or hospital name, or null",
  "billing_phone": "billing department phone number — search everywhere including small print, headers, footers, 'questions?' sections — or null",
  "bill_date": "YYYY-MM-DD or null",
  "total_amount": "total amount due as string, or null",
  "patient_name": "patient name or null",
  "account_number": "account or reference number or null",
  "line_items": [
    {
      "description": "plain-English explanation of what this charge is for — write as if explaining to a 75-year-old",
      "code": "CPT or billing code or null",
      "amount": "dollar amount as string or null",
      "flags": []
    }
  ],
  "missing_info": [],
  "biller_error_detected": false,
  "biller_error_description": null,
  "plain_english": "2-3 warm sentences explaining what this bill is for overall, written for a 75-year-old with no medical billing background"
}

FLAGGING RULES for line_items[].flags array (include all that apply):
- "missing_code": charge has no CPT or billing code
- "vague_description": description is too unclear to verify (e.g. 'services', 'supplies', 'miscellaneous')
- "possible_duplicate": same code or near-identical description appears more than once
- "biller_error": charge related to a suspected billing error (wrong insurer billed, coordination of benefits issue)

MISSING INFO examples for missing_info array:
- "itemized line items" (if bill just shows a total with no breakdown)
- "date of service" (if no service date is shown)
- "provider NPI number" (legally required on bills)
- "insurance submission details" (what was billed to insurance, what they paid)

BILLER ERROR detection: set biller_error_detected to true and explain in biller_error_description if you see:
- References to a denial from insurer A followed by a bill to the patient (suggesting wrong insurer was billed first)
- "Timely filing" or "filing deadline" language in the bill explanation
- Coordination of benefits confusion (multiple insurers mentioned)
- Any indication the biller made the submission error that led to the current patient balance`

// Strip markdown code fences if the model wraps JSON in ```json ... ``` blocks
function stripFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function fileContent(imageBase64, mediaType) {
  return mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } }
}

async function callClaude(body) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Worker error ${res.status}: ${await res.text()}`)
  return res.json()
}

// Pass 1 — narrow extraction. Uses Haiku (cheap/fast). Returns structured JSON only.
export async function analyzeDenial(imageBase64, mediaType) {
  const data = await callClaude({
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

  const parsed = JSON.parse(stripFences(data.content[0].text))
  if (!VALID_PLAN_TYPES.includes(parsed.plan_type)) parsed.plan_type = 'unclear'
  if (!VALID_DENIAL_REASONS.includes(parsed.denial_reason)) parsed.denial_reason = 'other'
  if (!VALID_APPEAL_LEVELS.includes(parsed.appeal_level)) parsed.appeal_level = 'unclear'
  return parsed
}

// Plain-English summary + basic field extraction for the upload step preview
export async function analyzePhoto(imageBase64, mediaType, language = 'en') {
  const langNote = language === 'es'
    ? '\n\nIMPORTANT: Write the "plain_english" field in Spanish. Write it warmly and simply, as if speaking to a 75-year-old Spanish speaker.'
    : ''
  const data = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [fileContent(imageBase64, mediaType), { type: 'text', text: PHOTO_PROMPT + langNote }],
      },
    ],
  })

  const parsed = JSON.parse(stripFences(data.content[0].text))
  if (!DENIAL_REASON_IDS.includes(parsed.denial_reason)) {
    parsed.denial_reason = 'other'
  }
  return parsed
}

export async function analyzeMedicalBill(imageBase64, mediaType, language = 'en') {
  const langNote = language === 'es'
    ? '\n\nIMPORTANT: Write the "plain_english" field in Spanish. Write it warmly and simply, as if speaking to a 75-year-old Spanish speaker.'
    : ''
  const data = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          fileContent(imageBase64, mediaType),
          { type: 'text', text: MEDICAL_BILL_PROMPT + langNote },
        ],
      },
    ],
  })

  const parsed = JSON.parse(stripFences(data.content[0].text))
  if (!Array.isArray(parsed.line_items)) parsed.line_items = []
  if (!Array.isArray(parsed.missing_info)) parsed.missing_info = []
  if (typeof parsed.biller_error_detected !== 'boolean') parsed.biller_error_detected = false
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
