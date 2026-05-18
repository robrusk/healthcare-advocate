# Medical Bill Flow Design

**Date:** 2026-05-18
**Scope:** Add medical bill analysis alongside existing denial letter flow — one upload, AI auto-detects document type, routes accordingly.

---

## Problem

Medical bills are deliberately opaque. Charges appear with no explanation, phone numbers are buried in small print, and billing errors — including biller-caused denials — get passed to patients who had no part in creating them. Patients pay bills they shouldn't owe because they don't know they can push back.

---

## Key Insight: Biller Error Non-Responsibility

Patients are **not legally responsible** for timely filing denials or coordination of benefits failures caused by the billing department's own errors. If the patient provided correct insurance information at time of service, the biller's failure to submit correctly is the provider's liability. This is one of the most common and least-known patient protections in medical billing.

---

## Architecture

### Auto-Detection (no toggle needed)

The existing `analyzePhoto()` call gets a new field: `document_type: "denial_letter" | "medical_bill"`.

- `denial_letter` → existing flow, unchanged
- `medical_bill` → new billing flow

If AI guesses wrong: a small **"Switch to [other type]"** text link lets the user override before proceeding.

### New Functions in `src/lib/claude.js`

**`analyzeMedicalBill(imageBase64, mediaType)`** — Haiku model, Pass 1 extraction.

Returns:
```json
{
  "document_type": "medical_bill",
  "provider_name": "string or null",
  "billing_phone": "string or null — extracted even from small print",
  "bill_date": "YYYY-MM-DD or null",
  "total_amount": "string or null",
  "patient_name": "string or null",
  "account_number": "string or null",
  "line_items": [
    {
      "description": "plain-English description of this charge",
      "code": "CPT/billing code or null",
      "amount": "dollar amount or null",
      "flags": ["missing_code", "vague_description", "possible_duplicate", "biller_error"]
    }
  ],
  "missing_info": ["itemized charges", "date of service", "provider NPI", "..."],
  "biller_error_detected": true | false,
  "biller_error_description": "plain-English description of the suspected error, or null",
  "plain_english": "2-3 sentence summary of what this bill is for, written for a 75-year-old"
}
```

**Flexibility:** All fields nullable. AI extracts what it can from any bill format — no rigid schema enforcement.

**`generateBillingLetters(extractedBill, submitterInfo)`** — Opus model, Pass 3 generation.

Returns two letters based on what was found:
- Always: `itemized_request` letter
- When `biller_error_detected`: `biller_error_dispute` letter

---

## Step Flow for Medical Bill

The 4-step tracker changes for the billing flow:
1. **📄 Scan Bill** — upload step (shared UI)
2. **🔍 AI Analysis** — reading the bill
3. **🧾 Bill Review** — flagged line items + red boxes (replaces Battle Plan)
4. **✉️ Your Letters** — dispute letters (same tabbed UI)

---

## Bill Review Screen (Step 3)

### Billing Phone — Big Red Box
```
📞 BILLING DEPARTMENT
[tap-to-call phone number]
[tap-to-call]
```
If no phone found: "📞 Call the main number on your bill and ask for the Billing Department."

### Biller Error Warning (shown when detected)
```
🚨 THIS MAY NOT BE YOUR RESPONSIBILITY

[plain-English description of what the AI detected]

If the billing department submitted to the wrong insurance
company or missed a filing deadline, you are not legally
required to pay for their error.
```
Styling: red border, prominent placement above line items.

### Plain-English Summary
2-3 sentences explaining what the bill is for overall.

### Line Items List
Each charge on its own row:
- Description (plain English)
- Code (CPT code if present, "No code" if missing)
- Amount
- Flag indicators:
  - ⚠ `missing_code` — no CPT code on charge
  - ⚠ `vague_description` — too vague to verify
  - 🚨 `possible_duplicate` — same code appears more than once
  - 🚨 `biller_error` — charge related to a suspected billing error

### Missing Info Box
If bill is missing legally-required information:
```
⚠ THIS BILL IS MISSING REQUIRED INFORMATION:
• [item 1]
• [item 2]
```

### Generate Letters Button
**"Generate Dispute Letters →"**

---

## Letter Results Screen (Step 4)

Same tabbed UI as denial flow. Tabs shown depend on what was found:

**Tab 1 — 📄 Itemized Bill Request** (always shown)

Demands:
1. Complete itemized statement with CPT codes for every charge
2. Date of service for each line item
3. Name and NPI of the provider who ordered each service
4. Confirmation of what was submitted to insurance and what insurance paid

If specific red flags found, letter calls them out by description:
> "I note that [charge description] has no billing code and an unclear description. Please clarify what this charge represents before I can process payment."

Closing line: **"I will not process payment until I receive the requested documentation."**

**Tab 2 — 🚨 Billing Error Dispute** (shown only when `biller_error_detected`)

Asserts:
- Patient provided correct insurance information at time of service
- Any denial resulting from incorrect submission sequence or missed filing deadlines is the provider's liability
- Patient is not responsible for errors made by the billing department
- Demands the provider resolve the matter with the insurers directly
- Explicitly states patient will not pay until the billing error is corrected

This letter is the one that protects patients in coordination-of-benefits disputes — the most common "you owe money for our mistake" scenario.

---

## Shared UI Elements (unchanged)

- "Who is submitting this?" section at top of form
- Submitter name/phone/email used in letter closings
- Heavy Hitters footer (state commissioner + congressional lookup)
- Calendar button if payment deadline is found on the bill

---

## Out of Scope

- Insurance claim status lookup
- EOB (Explanation of Benefits) analysis (separate feature)
- Payment plan negotiation letters
- Medical debt collection dispute letters (Fair Debt Collection Practices Act — future feature)

---

## Success Criteria

1. Upload a medical bill → AI correctly identifies it as `medical_bill`
2. Upload a denial letter → AI correctly identifies it as `denial_letter`, existing flow unchanged
3. "Switch to [other type]" override works if AI guesses wrong
4. Billing phone number is extracted and shown as tap-to-call
5. Line items with missing codes or vague descriptions are flagged
6. Biller error warning appears when coordination-of-benefits pattern is detected
7. Both letters generate correctly and include the submitter's name/contact in the closing
