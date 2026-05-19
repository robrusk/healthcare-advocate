# Home Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the denial-only home screen with two distinct entry points — Fight a Denial (red) and Review a Bill (teal) — each with its own copy, tone, and upload button that pre-sets documentType before opening the file picker.

**Architecture:** The upload step shows two cards when no photo has been taken yet. After a photo is uploaded and processed, the cards are replaced by the submitter form + summary + form fields. Each card's button pre-sets `documentType` before triggering the shared hidden file input, bypassing AI classification. A fallback link resets `documentType` to null and falls back to AI detection.

**Tech Stack:** React 18, Vite 8, Vitest

---

## File Map

| File | Action |
|------|--------|
| `src/App.jsx` | Modify header (font size, copy) + replace upload step with two-card layout |
| `src/App.test.jsx` | Update broken test, add new card render tests |

---

## Task 1: Update App.test.jsx

**Files:**
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Run existing tests to see current state**

```bash
cd "c:\Users\rrd4\Documents\claude super\healthcare-advocate"
npm run test:run
```

Expected: some tests pass. Note which ones reference "take photo" or "upload pdf" — those will need updating.

- [ ] **Step 2: Update `src/App.test.jsx`**

Replace the entire file with:

```jsx
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

  it('shows the form after a photo is uploaded via denial card', async () => {
    render(<App />)
    const file = new File(['img'], 'denial.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)
    await waitFor(() => {
      expect(screen.getByText(/your claim was denied/i)).toBeInTheDocument()
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
```

- [ ] **Step 3: Run tests to verify they fail (cards not yet rendered)**

```bash
npm run test:run
```

Expected: FAIL — "Unable to find an element with the text: /fight a denial/i"

- [ ] **Step 4: Commit the test changes**

```bash
git add src/App.test.jsx
git commit -m "test: update App tests for two-card home screen"
```

---

## Task 2: Update header and upload step in App.jsx

**Files:**
- Modify: `src/App.jsx`

**Read the file first before making any changes.**

- [ ] **Step 1: Update the header section**

Find:
```jsx
          <div style={{ fontSize: 13, letterSpacing: 4, color: "#00e5a0", textTransform: "uppercase", marginBottom: 12, fontFamily: "monospace" }}>
            🛡️ healthcareadvocate.org
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.15, letterSpacing: -1 }}>
            Fight Your{" "}
            <span style={{ color: "#ff3c3c", WebkitTextStroke: "1px #ff6060" }}>Denial.</span>
            <br />Win Your{" "}
            <span style={{ color: "#00e5a0" }}>Claim.</span>
          </h1>
          <p style={{ color: "rgba(232,244,240,0.55)", fontSize: 14, margin: 0, fontFamily: "monospace", letterSpacing: 1 }}>
            Free · Private · On Your Side
          </p>
```

Replace with:
```jsx
          <div style={{ fontSize: 17, letterSpacing: 4, color: "#00e5a0", textTransform: "uppercase", marginBottom: 10, fontFamily: "monospace" }}>
            🛡️ healthcareadvocate.org
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.2, letterSpacing: -0.5 }}>
            We're on your side.
          </h1>
          <p style={{ color: "rgba(232,244,240,0.55)", fontSize: 14, margin: 0, fontFamily: "monospace", letterSpacing: 0.5 }}>
            Free help fighting insurance denials and surprise medical bills.
          </p>
```

- [ ] **Step 2: Replace the upload step with two-card home + conditional form**

Find the entire upload step block — it starts with:
```jsx
        {step === "upload" && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
            <Card title="📋 Denial Details" subtitle="Tell us what happened">
```

And ends with the closing of that Card (find the `</Card>` followed by `</div>` that closes the `step === "upload"` block).

Replace the entire `{step === "upload" && (...)}` block with:

```jsx
        {step === "upload" && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>

            {/* HOME SCREEN: Two cards shown before any photo is uploaded */}
            {!photoSummary && !photoReading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Shared hidden file input */}
                <input
                  id="unified-file-input"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handlePhoto}
                  style={{ display: "none" }}
                />

                {/* Two cards */}
                <div style={{ display: "flex", gap: 12 }}>

                  {/* Fight a Denial — red */}
                  <div style={{
                    flex: 1, background: "rgba(255,60,60,0.06)",
                    border: "2px solid rgba(255,60,60,0.4)", borderRadius: 16,
                    padding: "20px 16px", display: "flex", flexDirection: "column",
                    gap: 12, boxShadow: "0 0 24px rgba(255,60,60,0.1)",
                  }}>
                    <div style={{ fontSize: 22, textAlign: "center" }}>⚔️</div>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: "#ff6060", margin: 0, textAlign: "center", fontFamily: "Georgia, serif" }}>
                      Fight a Denial
                    </h2>
                    <p style={{ fontSize: 13, color: "rgba(232,244,240,0.7)", lineHeight: 1.5, margin: 0, textAlign: "center", fontFamily: "Georgia, serif" }}>
                      Insurance denied your claim? You have a deadline. Let's fight back.
                    </p>
                    <label
                      htmlFor="unified-file-input"
                      onClick={() => setDocumentType('denial_letter')}
                      style={{
                        display: "block", textAlign: "center",
                        background: "linear-gradient(135deg, #ff3c3c, #cc1a1a)",
                        color: "#fff", fontWeight: 700, fontSize: 13,
                        fontFamily: "Georgia, serif", padding: "12px 10px",
                        borderRadius: 10, cursor: "pointer",
                        boxShadow: "0 0 16px rgba(255,60,60,0.3)",
                      }}
                    >
                      📷 Snap or Upload Denial Letter
                    </label>
                  </div>

                  {/* Review a Bill — teal */}
                  <div style={{
                    flex: 1, background: "rgba(0,229,160,0.05)",
                    border: "2px solid rgba(0,229,160,0.35)", borderRadius: 16,
                    padding: "20px 16px", display: "flex", flexDirection: "column",
                    gap: 12, boxShadow: "0 0 24px rgba(0,229,160,0.08)",
                  }}>
                    <div style={{ fontSize: 22, textAlign: "center" }}>🧾</div>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: "#00e5a0", margin: 0, textAlign: "center", fontFamily: "Georgia, serif" }}>
                      Review a Bill
                    </h2>
                    <p style={{ fontSize: 13, color: "rgba(232,244,240,0.7)", lineHeight: 1.5, margin: 0, textAlign: "center", fontFamily: "Georgia, serif" }}>
                      Got a medical bill? Don't pay until we check it.
                    </p>
                    <label
                      htmlFor="unified-file-input"
                      onClick={() => setDocumentType('medical_bill')}
                      style={{
                        display: "block", textAlign: "center",
                        background: "linear-gradient(135deg, #00e5a0, #00b87a)",
                        color: "#0a0e1a", fontWeight: 700, fontSize: 13,
                        fontFamily: "Georgia, serif", padding: "12px 10px",
                        borderRadius: 10, cursor: "pointer",
                        boxShadow: "0 0 16px rgba(0,229,160,0.2)",
                      }}
                    >
                      📷 Snap or Upload Medical Bill
                    </label>
                  </div>
                </div>

                {/* Fallback link */}
                <p style={{ textAlign: "center", margin: "4px 0 0" }}>
                  <button
                    onClick={() => {
                      setDocumentType(null);
                      document.getElementById('unified-file-input').click();
                    }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "rgba(232,244,240,0.35)", fontSize: 12,
                      fontFamily: "monospace", textDecoration: "underline",
                    }}
                  >
                    Not sure what you have? Tap here and we'll figure it out.
                  </button>
                </p>
              </div>
            )}

            {/* FORM: Shown after photo is uploaded/processing */}
            {(photoSummary || photoReading) && (
              <Card
                title={documentType === 'medical_bill' ? '🧾 Bill Details' : '📋 Denial Details'}
                subtitle={documentType === 'medical_bill' ? 'Review and confirm what we found' : 'Tell us what happened'}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Who is submitting */}
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: "#00e5a0", fontFamily: "monospace", marginBottom: 12 }}>
                      {documentType === 'medical_bill' ? 'WHO IS HANDLING THIS?' : 'WHO IS SUBMITTING THIS APPEAL?'}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {[
                        { id: "patient", label: "The Patient" },
                        { id: "spouse", label: "Spouse / Partner" },
                        { id: "adult_child", label: "Adult Child" },
                        { id: "family", label: "Other Family" },
                        { id: "advocate", label: "Caregiver / Advocate" },
                      ].map((r) => (
                        <button key={r.id} onClick={() => setSubmitterRelationship(r.id)} style={{
                          background: submitterRelationship === r.id ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${submitterRelationship === r.id ? "#00e5a0" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 20, padding: "6px 14px", cursor: "pointer",
                          color: submitterRelationship === r.id ? "#00e5a0" : "rgba(232,244,240,0.6)",
                          fontSize: 13, fontFamily: "Georgia, serif", transition: "all 0.2s",
                        }}>{r.label}</button>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Field label="Your Name" value={submitterName} onChange={setSubmitterName} placeholder="Jane Smith" />
                      <Field label="Your Phone" value={submitterPhone} onChange={setSubmitterPhone} placeholder="(555) 000-0000" />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Field label="Your Email" value={submitterEmail} onChange={setSubmitterEmail} placeholder="jane@email.com" />
                    </div>
                  </div>

                  {/* Reading state */}
                  {photoReading && (
                    <div style={{ textAlign: "center", padding: "16px 0", background: "rgba(0,229,160,0.06)", borderRadius: 10, border: "1px solid rgba(0,229,160,0.15)" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                      <p style={{ fontFamily: "monospace", fontSize: 13, color: "#00e5a0", margin: 0 }}>
                        {documentType === 'medical_bill' ? 'Reading your bill...' : 'Reading your letter...'}
                      </p>
                    </div>
                  )}

                  {/* Plain-English summary */}
                  {photoSummary && !photoReading && (
                    <div style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.25)", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, letterSpacing: 2, color: "#00e5a0", fontFamily: "monospace", marginBottom: 8 }}>
                        {documentType === 'medical_bill' ? '📋 WHAT THIS BILL IS FOR' : '📋 WHAT YOUR LETTER SAYS'}
                      </div>
                      <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(232,244,240,0.9)", margin: "0 0 8px" }}>{photoSummary}</p>
                      <p style={{ fontSize: 11, color: "rgba(232,244,240,0.4)", fontFamily: "monospace", margin: 0 }}>
                        {documentType === 'medical_bill'
                          ? 'Fields below were filled in from your bill — review and correct anything that looks wrong.'
                          : 'Fields below were filled in from your letter — review and correct anything that looks wrong.'}
                      </p>
                    </div>
                  )}

                  {/* Denial-only fields */}
                  {documentType !== 'medical_bill' && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Patient Name" value={patientName} onChange={setPatientName} placeholder="Jane Smith" />
                        <Field label="Claim Number" value={claimNumber} onChange={setClaimNumber} placeholder="CLM-2024-XXXXX" />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Insurance Company" value={insurerName} onChange={setInsurerName} placeholder="UnitedHealth, Cigna..." />
                        <Field label="Treatment / Service" value={treatment} onChange={setTreatment} placeholder="MRI, Surgery, Therapy..." />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#00e5a0", fontFamily: "monospace", display: "block", marginBottom: 8 }}>
                          Denial Reason *
                        </label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {DENY_REASONS.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => setDenialReason(r.id)}
                              style={{
                                background: denialReason === r.id ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.03)",
                                border: `1px solid ${denialReason === r.id ? "#00e5a0" : "rgba(255,255,255,0.08)"}`,
                                borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "left",
                                color: denialReason === r.id ? "#00e5a0" : "rgba(232,244,240,0.7)",
                                fontSize: 14, fontFamily: "Georgia, serif", transition: "all 0.2s",
                                display: "flex", alignItems: "center", gap: 8,
                              }}
                            >
                              <span style={{ fontSize: 10, opacity: 0.5 }}>{denialReason === r.id ? "●" : "○"}</span>
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#00e5a0", fontFamily: "monospace", display: "block", marginBottom: 8 }}>
                          Paste Denial Letter Text (optional)
                        </label>
                        <textarea
                          value={denialText}
                          onChange={(e) => setDenialText(e.target.value)}
                          placeholder="Paste the text from your denial letter here for better analysis..."
                          rows={4}
                          style={{
                            width: "100%", background: "#1a2535", border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 8, padding: 12, color: "#e8f4f0", fontSize: 13, fontFamily: "monospace",
                            resize: "vertical", outline: "none", boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </>
                  )}

                  <button
                    onClick={runAnalysis}
                    disabled={documentType === 'medical_bill' ? false : !denialReason}
                    style={{
                      background: (documentType === 'medical_bill' || denialReason) ? "linear-gradient(135deg, #00e5a0, #00b87a)" : "rgba(255,255,255,0.05)",
                      border: "none", borderRadius: 10, padding: "16px 24px",
                      cursor: (documentType === 'medical_bill' || denialReason) ? "pointer" : "not-allowed",
                      color: (documentType === 'medical_bill' || denialReason) ? "#0a0e1a" : "rgba(255,255,255,0.3)",
                      fontSize: 15, fontWeight: 700, fontFamily: "Georgia, serif",
                      letterSpacing: 0.5, transition: "all 0.3s",
                      boxShadow: (documentType === 'medical_bill' || denialReason) ? "0 0 30px rgba(0,229,160,0.3)" : "none",
                    }}
                  >
                    {documentType === 'medical_bill' ? '🔍 Analyze This Bill →' : '🔍 Analyze My Denial →'}
                  </button>
                </div>
              </Card>
            )}
          </div>
        )}
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npm run test:run
```

Expected: PASS — all tests passing

- [ ] **Step 4: Build to verify no errors**

```bash
npm run build
```

Expected: clean build

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: two-card home screen — Fight a Denial (red) + Review a Bill (teal)"
```

---

## Task 3: Push and verify

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Build and upload to server**

Run `npm run build`, then upload `dist/` contents to server via FileZilla.

- [ ] **Step 3: Verify on device**

1. Open `https://healthcareadvocate.org` — should show two cards, no form
2. `healthcareadvocate.org` header should be noticeably larger
3. Tap "Fight a Denial" card → file picker opens → upload sample denial letter → form appears with denial fields
4. Start over → tap "Review a Bill" card → file picker opens → upload bill → form appears without denial reason selector
5. Tap "Not sure what you have?" → file picker opens without pre-setting document type
6. Verify step tracker updates correctly for each path
