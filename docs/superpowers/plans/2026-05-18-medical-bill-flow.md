# Medical Bill Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a medical bill analysis flow alongside the existing denial letter flow — one upload detects document type and routes accordingly, with line-item flags, biller error detection, and two dispute letters.

**Architecture:** `analyzePhoto()` gets a `document_type` field; when `medical_bill` is returned, `analyzeMedicalBill()` runs a second Haiku extraction pass. App.jsx branches on document type to either the existing denial flow or a new billing flow with `BillReviewScreen` and two generated letters. All billing state is parallel to existing denial state — no shared mutation.

**Tech Stack:** React 18, Vite 8, Vitest, @testing-library/react, Cloudflare Worker proxy (existing)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/claude.js` | Modify | Add `document_type` to `analyzePhoto()` prompt; add `analyzeMedicalBill()` |
| `src/lib/claude.test.js` | Modify | Tests for `analyzeMedicalBill()` |
| `src/components/BillReviewScreen.jsx` | Create | Phone box, biller error warning, line items with flags, missing info, generate button |
| `src/components/BillReviewScreen.test.jsx` | Create | Component tests |
| `src/App.jsx` | Modify | `documentType` state, bill extraction state, bill steps, `generateBillingLetters()`, billing letters display |

---

## Task 1: Update `analyzePhoto()` and add `analyzeMedicalBill()`

**Files:**
- Modify: `src/lib/claude.js`
- Modify: `src/lib/claude.test.js`

- [ ] **Step 1: Add `document_type` field to `PHOTO_PROMPT` in `src/lib/claude.js`**

Find the `PHOTO_PROMPT` constant. Replace the closing line:
```js
Respond with ONLY the raw JSON object. No markdown code fences. No other text.`
```
With:
```js
{
  "plain_english": "...",
  "document_type": "One of: denial_letter or medical_bill — infer from the document content",
  "denial_reason": "...",
  "patient_name": "...",
  "claim_number": "...",
  "insurer_name": "...",
  "treatment": "..."
}

Respond with ONLY the raw JSON object. No markdown code fences. No other text.`
```

- [ ] **Step 2: Add `MEDICAL_BILL_PROMPT` constant and `analyzeMedicalBill()` function to `src/lib/claude.js`**

Add after the existing `PHOTO_PROMPT` constant:

```js
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
```

Then add the function:

```js
export async function analyzeMedicalBill(imageBase64, mediaType) {
  const data = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          fileContent(imageBase64, mediaType),
          { type: 'text', text: MEDICAL_BILL_PROMPT },
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
```

- [ ] **Step 3: Write failing tests in `src/lib/claude.test.js`**

Add to the existing test file (after the existing describe blocks):

```js
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
      plain_english: 'This bill is for a routine blood draw done at your doctor\'s office.',
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
      biller_error_description: 'Bill was submitted to wrong insurer first, causing timely filing denial.',
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
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd "c:\Users\rrd4\Documents\claude super\healthcare-advocate"
npm run test:run
```

Expected: FAIL — "analyzeMedicalBill is not exported"

- [ ] **Step 5: Run tests again to verify they pass**

```bash
npm run test:run
```

Expected: PASS — all tests passing (new tests + existing)

- [ ] **Step 6: Commit**

```bash
git add src/lib/claude.js src/lib/claude.test.js
git commit -m "feat: add analyzeMedicalBill() and document_type to analyzePhoto()"
```

---

## Task 2: BillReviewScreen component

**Files:**
- Create: `src/components/BillReviewScreen.jsx`
- Create: `src/components/BillReviewScreen.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/BillReviewScreen.test.jsx`:

```jsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run
```

Expected: FAIL — "Cannot find module './BillReviewScreen'"

- [ ] **Step 3: Create `src/components/BillReviewScreen.jsx`**

```jsx
const FLAG_LABELS = {
  missing_code: { icon: '⚠', label: 'No billing code', color: '#ffd700' },
  vague_description: { icon: '⚠', label: 'Vague description', color: '#ffd700' },
  possible_duplicate: { icon: '🚨', label: 'Possible duplicate', color: '#ff6060' },
  biller_error: { icon: '🚨', label: 'Possible biller error', color: '#ff6060' },
}

export default function BillReviewScreen({ bill, onGenerate, onSwitch }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeSlideIn 0.5s ease' }}>

      {/* Billing Phone — Big Red Box */}
      <div style={{
        background: 'rgba(255,60,60,0.12)', border: '2px solid rgba(255,60,60,0.5)',
        borderRadius: 12, padding: '16px 20px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: '#ff6060', fontFamily: 'monospace', marginBottom: 8 }}>
          📞 BILLING DEPARTMENT
        </div>
        {bill.billing_phone ? (
          <a href={`tel:${bill.billing_phone.replace(/\D/g, '')}`} style={{
            fontSize: 20, fontWeight: 700, color: '#ff6060', textDecoration: 'none',
            fontFamily: 'monospace', letterSpacing: 1,
          }}>
            {bill.billing_phone}
          </a>
        ) : (
          <p style={{ fontSize: 14, color: 'rgba(232,244,240,0.7)', margin: 0, fontFamily: 'Georgia, serif' }}>
            Call the number on your bill and ask for the Billing Department.
          </p>
        )}
      </div>

      {/* Biller Error Warning */}
      {bill.biller_error_detected && (
        <div style={{
          background: 'rgba(255,60,60,0.08)', border: '2px solid rgba(255,60,60,0.4)',
          borderRadius: 12, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6060', marginBottom: 8, fontFamily: 'Georgia, serif' }}>
            🚨 THIS MAY NOT BE YOUR RESPONSIBILITY
          </div>
          <p style={{ fontSize: 13, color: 'rgba(232,244,240,0.8)', lineHeight: 1.6, margin: '0 0 8px', fontFamily: 'Georgia, serif' }}>
            {bill.biller_error_description}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(232,244,240,0.5)', margin: 0, fontFamily: 'monospace' }}>
            If the billing department submitted to the wrong insurance company or missed a filing deadline,
            you are not legally required to pay for their error. The dispute letter below addresses this.
          </p>
        </div>
      )}

      {/* Plain English Summary */}
      {bill.plain_english && (
        <div style={{
          background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#00e5a0', fontFamily: 'monospace', marginBottom: 8 }}>
            📋 WHAT THIS BILL IS FOR
          </div>
          <p style={{ fontSize: 14, color: 'rgba(232,244,240,0.9)', lineHeight: 1.7, margin: 0, fontFamily: 'Georgia, serif' }}>
            {bill.plain_english}
          </p>
        </div>
      )}

      {/* Line Items */}
      {bill.line_items.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(232,244,240,0.4)', fontFamily: 'monospace', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            CHARGES
          </div>
          {bill.line_items.map((item, i) => (
            <div key={i} style={{
              padding: '12px 14px',
              borderBottom: i < bill.line_items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              background: item.flags.length > 0 ? 'rgba(255,215,0,0.03)' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#e8f4f0', fontFamily: 'Georgia, serif', marginBottom: 2 }}>
                    {item.description}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(232,244,240,0.35)', fontFamily: 'monospace' }}>
                    {item.code || 'No billing code'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e8f4f0', fontFamily: 'monospace' }}>
                    {item.amount || '—'}
                  </div>
                </div>
              </div>
              {item.flags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {item.flags.map((flag) => {
                    const f = FLAG_LABELS[flag] || { icon: '⚠', label: flag, color: '#ffd700' }
                    return (
                      <span key={flag} style={{
                        fontSize: 11, fontFamily: 'monospace', color: f.color,
                        background: `${f.color}18`, border: `1px solid ${f.color}44`,
                        borderRadius: 4, padding: '2px 8px',
                      }}>
                        {f.icon} {f.label}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Missing Info */}
      {bill.missing_info.length > 0 && (
        <div style={{
          background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.25)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#ffd700', fontFamily: 'monospace', marginBottom: 8 }}>
            ⚠ THIS BILL IS MISSING REQUIRED INFORMATION
          </div>
          {bill.missing_info.map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: 'rgba(232,244,240,0.7)', fontFamily: 'Georgia, serif', marginBottom: 4 }}>
              • {item}
            </div>
          ))}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        style={{
          background: 'linear-gradient(135deg, #ff3c3c, #cc1a1a)',
          border: 'none', borderRadius: 10, padding: '16px 24px', cursor: 'pointer',
          color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Georgia, serif',
          width: '100%', boxShadow: '0 0 30px rgba(255,60,60,0.3)',
        }}
      >
        ✉️ Generate Dispute Letters →
      </button>

      {/* Switch link */}
      <button
        onClick={onSwitch}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(232,244,240,0.3)', fontSize: 12, fontFamily: 'monospace',
          textDecoration: 'underline',
        }}
      >
        Switch to denial letter flow instead
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run
```

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/components/BillReviewScreen.jsx src/components/BillReviewScreen.test.jsx
git commit -m "feat: add BillReviewScreen — phone box, biller error warning, flagged line items"
```

---

## Task 3: Wire document type detection and bill state into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `analyzeMedicalBill` import**

Find the existing import:
```jsx
import { analyzePhoto, analyzeDenial, fileToBase64 } from "./lib/claude";
```

Replace with:
```jsx
import { analyzePhoto, analyzeDenial, analyzeMedicalBill, fileToBase64 } from "./lib/claude";
```

- [ ] **Step 2: Add `BillReviewScreen` import**

Find the existing import:
```jsx
import { FactsUsedCard } from "./components/FactsUsedCard";
```

Add after it:
```jsx
import BillReviewScreen from "./components/BillReviewScreen";
```

- [ ] **Step 3: Add bill-related state variables**

In `InsuranceFighter`, find the state block (near `const [step, setStep]`). Add these after the existing state declarations:

```jsx
const [documentType, setDocumentType] = useState(null);
const [billExtraction, setBillExtraction] = useState(null);
const [billingLetters, setBillingLetters] = useState({ itemized_request: '', biller_error_dispute: '' });
const [activeBillingTab, setActiveBillingTab] = useState('itemized_request');
const [generatingBilling, setGeneratingBilling] = useState(false);
const [photoBase64Stored, setPhotoBase64Stored] = useState(null);
const [photoMediaTypeStored, setPhotoMediaTypeStored] = useState(null);
```

- [ ] **Step 4: Clear bill state in `reset()`**

Find the `reset()` function. Add these resets alongside the existing ones:

```jsx
setDocumentType(null);
setBillExtraction(null);
setBillingLetters({ itemized_request: '', biller_error_dispute: '' });
setActiveBillingTab('itemized_request');
setGeneratingBilling(false);
setPhotoBase64Stored(null);
setPhotoMediaTypeStored(null);
```

- [ ] **Step 5: Update `handlePhoto` to store base64 and detect document type**

Find in `handlePhoto`:
```jsx
    try {
      const base64 = await fileToBase64(file);
      setPhotoBase64(base64);
      setPhotoMediaType(file.type);
      const result = await analyzePhoto(base64, file.type);
      setPhotoSummary(result.plain_english);
```

Replace with:
```jsx
    try {
      const base64 = await fileToBase64(file);
      setPhotoBase64(base64);
      setPhotoMediaType(file.type);
      setPhotoBase64Stored(base64);
      setPhotoMediaTypeStored(file.type);
      const result = await analyzePhoto(base64, file.type);
      setDocumentType(result.document_type || 'denial_letter');
      setPhotoSummary(result.plain_english);
```

- [ ] **Step 6: Update `runAnalysis` to branch on document type**

Find `runAnalysis`:
```jsx
  const runAnalysis = async () => {
    if (!denialReason) return;
    setAnalyzing(true);
    setStep("analyze");

    const [, extraction] = await Promise.all([
      new Promise((r) => setTimeout(r, 800)),
      photoBase64
        ? analyzeDenial(photoBase64, photoMediaType).catch(() => null)
        : Promise.resolve(null),
    ]);

    setDenialExtraction(extraction);
    setConfirmedExtraction(extraction ? { ...extraction } : null);
    setAnalysisResult(INSURANCE_KEYWORDS[denialReason]);
    setAnalyzing(false);
    setTimeout(() => setStep("strategy"), 400);
  };
```

Replace with:
```jsx
  const runAnalysis = async () => {
    setAnalyzing(true);
    setStep("analyze");

    if (documentType === 'medical_bill') {
      try {
        const bill = await analyzeMedicalBill(photoBase64Stored, photoMediaTypeStored);
        setBillExtraction(bill);
      } catch {
        setBillExtraction({ line_items: [], missing_info: [], biller_error_detected: false, biller_error_description: null, plain_english: "Could not fully read this bill. Please review manually." });
      }
      setAnalyzing(false);
      setTimeout(() => setStep("bill_review"), 400);
      return;
    }

    if (!denialReason) { setAnalyzing(false); return; }

    const [, extraction] = await Promise.all([
      new Promise((r) => setTimeout(r, 800)),
      photoBase64
        ? analyzeDenial(photoBase64, photoMediaType).catch(() => null)
        : Promise.resolve(null),
    ]);

    setDenialExtraction(extraction);
    setConfirmedExtraction(extraction ? { ...extraction } : null);
    setAnalysisResult(INSURANCE_KEYWORDS[denialReason]);
    setAnalyzing(false);
    setTimeout(() => setStep("strategy"), 400);
  };
```

- [ ] **Step 7: Update the "Analyze My Denial" button to show for both flows**

Find the button at the bottom of the upload card:
```jsx
              disabled={!denialReason}
```

Replace with:
```jsx
              disabled={documentType === 'medical_bill' ? false : !denialReason}
```

And update the button label to be dynamic. Find:
```jsx
                  🔍 Analyze My Denial →
```

Replace with:
```jsx
                  {documentType === 'medical_bill' ? '🔍 Analyze This Bill →' : '🔍 Analyze My Denial →'}
```

- [ ] **Step 8: Update STEPS display to be dynamic**

Find the steps tracker JSX. It maps over `STEPS`. Add a computed variable just before the return statement of `InsuranceFighter`:

```jsx
  const currentSteps = documentType === 'medical_bill'
    ? [
        { id: "upload", label: "Scan Bill", icon: "📄" },
        { id: "analyze", label: "AI Analysis", icon: "🔍" },
        { id: "bill_review", label: "Bill Review", icon: "🧾" },
        { id: "bill_letters", label: "Dispute Letters", icon: "✉️" },
      ]
    : STEPS;
```

Then find where `STEPS.map(` is used in the step tracker JSX and replace with `currentSteps.map(`.

Also update the `stepIndex` computation. Find:
```jsx
  const stepIndex = STEPS.findIndex((s) => s.id === step);
```

Replace with:
```jsx
  const stepIndex = currentSteps.findIndex((s) => s.id === step);
```

- [ ] **Step 9: Build to verify no errors**

```bash
npm run build
```

Expected: clean build

- [ ] **Step 10: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add document type detection and bill flow routing in App.jsx"
```

---

## Task 4: Render BillReviewScreen and add `generateBillingLetters()`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add bill_review step rendering**

Find in the JSX the strategy step block:
```jsx
        {step === "strategy" && analysisResult && (
```

Add the bill review step just before it:

```jsx
        {step === "bill_review" && billExtraction && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
            <BillReviewScreen
              bill={billExtraction}
              onGenerate={generateBillingLetters}
              onSwitch={() => { setDocumentType('denial_letter'); setStep('upload'); }}
            />
          </div>
        )}
```

- [ ] **Step 2: Add `generateBillingLetters()` function**

Add this function just before the existing `generateLetter()` function:

```jsx
  const generateBillingLetters = async () => {
    setGeneratingBilling(true);
    setStep("bill_letters");
    setActiveBillingTab("itemized_request");

    const signerName = submitterName || "[YOUR NAME]";
    const signerContact = [submitterPhone, submitterEmail].filter(Boolean).join(" | ") || "[YOUR PHONE / EMAIL]";
    const providerName = billExtraction.provider_name || "[PROVIDER NAME]";
    const accountNumber = billExtraction.account_number || "[ACCOUNT NUMBER]";

    const flaggedItems = (billExtraction.line_items || [])
      .filter(item => item.flags.length > 0)
      .map(item => `- ${item.description} (${item.amount || 'amount unclear'}): ${item.flags.join(', ')}`)
      .join('\n');

    const missingInfo = (billExtraction.missing_info || []).join(', ');

    const itemizedPrompt = `You are a patient advocate. Write a firm, professional letter to the medical billing department requesting an itemized bill.

Provider: ${providerName}
Account Number: ${accountNumber}
Patient: ${billExtraction.patient_name || "[PATIENT NAME]"}
Bill Date: ${billExtraction.bill_date || "[BILL DATE]"}
Total Billed: ${billExtraction.total_amount || "[TOTAL AMOUNT]"}
Written by: ${signerName}
${flaggedItems ? `\nFlagged charges requiring clarification:\n${flaggedItems}` : ''}
${missingInfo ? `\nMissing required information: ${missingInfo}` : ''}

INSTRUCTIONS:
1. Demand a complete itemized statement with CPT codes for every charge
2. Request the date of service for each line item
3. Request the name and NPI of the provider who ordered each service
4. Request confirmation of what was submitted to insurance and what insurance paid
5. If flagged charges exist, call each one out specifically and demand clarification
6. Close with: "I will not process payment until I receive the requested documentation."
7. ${signerName === "[YOUR NAME]" ? "Use [YOUR NAME] as placeholder for signature" : `Close with ${signerName}'s name and contact: ${signerContact}`}
8. Under 400 words. Start with the date line. Write ONLY the letter.`;

    const billerErrorPrompt = `You are a patient advocate. Write a firm letter asserting that the patient is not responsible for a billing department error.

Provider: ${providerName}
Account Number: ${accountNumber}
Patient: ${billExtraction.patient_name || "[PATIENT NAME]"}
Error Description: ${billExtraction.biller_error_description || "The billing department submitted to the wrong insurance company or missed a filing deadline."}
Written by: ${signerName}

INSTRUCTIONS:
1. Assert clearly that the patient provided correct insurance information at time of service
2. State that any denial resulting from incorrect submission sequence or missed filing deadlines is the provider's liability, not the patient's
3. Demand the billing department resolve the matter with the insurers directly before pursuing the patient for payment
4. Explicitly state the patient will not pay this balance until the billing error is corrected
5. Reference that timely filing denials caused by biller error are not patient responsibility under applicable billing regulations
6. ${signerName === "[YOUR NAME]" ? "Use [YOUR NAME] as placeholder for signature" : `Close with ${signerName}'s name and contact: ${signerContact}`}
7. Under 400 words. Start with the date line. Write ONLY the letter.`;

    try {
      const letters = { itemized_request: '', biller_error_dispute: '' };

      const calls = [
        callClaude({ model: "claude-opus-4-7", max_tokens: 800, messages: [{ role: "user", content: itemizedPrompt }] })
          .then(r => { letters.itemized_request = r.content.find(b => b.type === "text")?.text || "" }),
      ];

      if (billExtraction.biller_error_detected) {
        calls.push(
          callClaude({ model: "claude-opus-4-7", max_tokens: 800, messages: [{ role: "user", content: billerErrorPrompt }] })
            .then(r => { letters.biller_error_dispute = r.content.find(b => b.type === "text")?.text || "" })
        );
      }

      await Promise.all(calls);
      setBillingLetters(letters);
    } catch (e) {
      setBillingLetters({ itemized_request: "Error generating letter. Please try again.", biller_error_dispute: "" });
    }
    setGeneratingBilling(false);
  };
```

- [ ] **Step 3: Add bill_letters step rendering**

Find the letter step block:
```jsx
        {step === "letter" && (
```

Add the billing letters step just before it:

```jsx
        {step === "bill_letters" && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
            <div style={{
              background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
              padding: "24px 20px", marginBottom: 16,
              boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            }}>
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>✉️ Your Dispute Letters</h2>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(232,244,240,0.45)", fontFamily: "monospace" }}>
                  Ready to send — review and edit before mailing
                </p>
              </div>

              {generatingBilling && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>✍️</div>
                  <p style={{ fontFamily: "monospace", color: "#00e5a0", fontSize: 14 }}>Writing your dispute letters...</p>
                </div>
              )}

              {!generatingBilling && billingLetters.itemized_request && (
                <>
                  {/* Tabs */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                    <button
                      onClick={() => setActiveBillingTab("itemized_request")}
                      style={{
                        flex: 1, padding: "10px 6px", cursor: "pointer", fontSize: 12,
                        fontFamily: "Georgia, serif", borderRadius: 8, transition: "all 0.2s",
                        background: activeBillingTab === "itemized_request" ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${activeBillingTab === "itemized_request" ? "#00e5a0" : "rgba(255,255,255,0.1)"}`,
                        color: activeBillingTab === "itemized_request" ? "#00e5a0" : "rgba(232,244,240,0.5)",
                        fontWeight: activeBillingTab === "itemized_request" ? 700 : 400,
                      }}
                    >📄 Itemized Bill Request</button>
                    {billExtraction?.biller_error_detected && (
                      <button
                        onClick={() => setActiveBillingTab("biller_error_dispute")}
                        style={{
                          flex: 1, padding: "10px 6px", cursor: "pointer", fontSize: 12,
                          fontFamily: "Georgia, serif", borderRadius: 8, transition: "all 0.2s",
                          background: activeBillingTab === "biller_error_dispute" ? "rgba(255,60,60,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${activeBillingTab === "biller_error_dispute" ? "#ff6060" : "rgba(255,255,255,0.1)"}`,
                          color: activeBillingTab === "biller_error_dispute" ? "#ff6060" : "rgba(232,244,240,0.5)",
                          fontWeight: activeBillingTab === "biller_error_dispute" ? 700 : 400,
                        }}
                      >🚨 Billing Error Dispute</button>
                    )}
                  </div>

                  {/* Letter body */}
                  <div style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: 20, marginBottom: 16, maxHeight: 500, overflowY: "auto",
                  }}>
                    <pre style={{ fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.7, color: "rgba(232,244,240,0.9)", whiteSpace: "pre-wrap", margin: 0 }}>
                      {billingLetters[activeBillingTab] || ""}
                    </pre>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <button
                      onClick={() => { navigator.clipboard.writeText(billingLetters[activeBillingTab] || ""); }}
                      style={{
                        flex: 1, background: "rgba(0,229,160,0.1)", border: "1px solid #00e5a0",
                        borderRadius: 8, padding: "12px 16px", cursor: "pointer",
                        color: "#00e5a0", fontSize: 14, fontFamily: "Georgia, serif",
                      }}
                    >📋 Copy Letter</button>
                    <button
                      onClick={generateBillingLetters}
                      style={{
                        flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8, padding: "12px 16px", cursor: "pointer",
                        color: "rgba(232,244,240,0.6)", fontSize: 14, fontFamily: "Georgia, serif",
                      }}
                    >🔄 Regenerate</button>
                  </div>
                </>
              )}

              <button onClick={reset} style={{
                width: "100%", marginTop: 8, background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "12px",
                cursor: "pointer", color: "rgba(232,244,240,0.4)", fontSize: 13, fontFamily: "Georgia, serif",
              }}>
                ← Start Over
              </button>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Build to verify no errors**

```bash
npm run build
```

Expected: clean build

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: PASS — all tests passing

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add bill_review and bill_letters steps, generateBillingLetters()"
```

---

## Task 5: Push and manual verification

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Build and upload to server**

```bash
npm run build
```

Upload `dist/` contents to server via FileZilla.

- [ ] **Step 3: Test with a medical bill**

1. Open `https://healthcareadvocate.org`
2. Upload a medical bill (photo or PDF)
3. Verify: plain-English summary appears, document type detected as `medical_bill`
4. Click "Analyze This Bill →"
5. Verify: BillReviewScreen shows with phone number, any flagged line items, generate button
6. Click "Generate Dispute Letters →"
7. Verify: Itemized Bill Request letter generates
8. If biller error detected: verify Billing Error Dispute tab appears

- [ ] **Step 4: Test override (switch link)**

1. Upload a denial letter
2. If app detects it as `medical_bill` (unlikely but possible): click "Switch to denial letter flow instead"
3. Verify: routes back to upload step with `documentType` reset to `denial_letter`

- [ ] **Step 5: Test denial letter flow unchanged**

1. Upload the sample denial letter PDF
2. Verify: existing denial flow works exactly as before
3. Three letters still generate (insurance, hospital, doctor)
