# Verified Library (Layer 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an on-device document library that grounds AI letter generation in verified official sources, with a visible "Facts Used" card showing users exactly which documents were consulted.

**Architecture:** `src/library/index.js` uses `import.meta.glob` to bundle all markdown library files at build time. `lookupVerifiedFacts()` takes the confirmed extraction (plan_type, denial_reason, state) and returns `silentContext` (injected into the letter prompt) and `visibleCitations` (shown in the FactsUsedCard UI component). The letter prompt instruction tells the model to answer only from those documents.

**Tech Stack:** React 18, Vite 8 (import.meta.glob), Vitest, @testing-library/react

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/library/index.js` | Create | Lookup engine — parseMarkdown + lookupVerifiedFacts |
| `src/library/index.test.js` | Create | Unit tests for lookup engine |
| `src/library/medicare_advantage/medical_necessity.md` | Create | Real curated content — CMS medical necessity rules |
| `src/library/employer_erisa/medical_necessity.md` | Create | Real curated content — ERISA medical necessity rules |
| `src/library/medicare_advantage/*.md` (5 stubs) | Create | Stub files for other denial reasons |
| `src/library/employer_erisa/*.md` (5 stubs) | Create | Stub files for other denial reasons |
| `src/components/FactsUsedCard.jsx` | Create | Visible citations UI card |
| `src/components/FactsUsedCard.test.jsx` | Create | Component tests |
| `src/App.jsx` | Modify | Import lookupVerifiedFacts + FactsUsedCard, wire into generateLetter, render card |

---

## Task 1: Library directory structure and stub files

**Files:**
- Create: `src/library/medicare_advantage/` (6 files)
- Create: `src/library/employer_erisa/` (6 files)

- [ ] **Step 1: Create stub markdown files for medicare_advantage**

Create `src/library/medicare_advantage/prior_auth_missing.md`:
```markdown
---
title: "Medicare Advantage Prior Authorization Requirements"
summary: "CMS rules governing when Medicare Advantage plans may require prior authorization."
source: "42 C.F.R. § 422.138, CMS Prior Authorization and Step Therapy for Part B Drugs"
updated: 2026
---

## Stub — Content Pending

This file is a placeholder. Curated content from official CMS sources will be added here.
When complete, this file will cover prior authorization requirements for Medicare Advantage plans,
including the 2023 CMS rule limiting prior auth use for medically necessary services.
```

Create `src/library/medicare_advantage/experimental.md`:
```markdown
---
title: "Medicare Advantage Coverage of Investigational Treatments"
summary: "Rules governing when Medicare Advantage plans may deny coverage as experimental or investigational."
source: "42 C.F.R. § 422.101, CMS National Coverage Determinations (NCD) Manual"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover CMS standards for determining whether a treatment is investigational,
and the requirement that MA plans follow Original Medicare coverage rules.
```

Create `src/library/medicare_advantage/out_of_network.md`:
```markdown
---
title: "Medicare Advantage Network Adequacy Requirements"
summary: "CMS standards requiring Medicare Advantage plans to maintain adequate provider networks."
source: "42 C.F.R. § 422.116, CMS Network Adequacy Final Rule 2024"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover MA plan network adequacy standards, out-of-network emergency coverage
requirements, and the right to access out-of-network providers when in-network options are unavailable.
```

Create `src/library/medicare_advantage/not_covered.md`:
```markdown
---
title: "Medicare Advantage Required Coverage Rules"
summary: "Medicare Advantage plans must cover all services covered by Original Medicare Parts A and B."
source: "42 C.F.R. § 422.101(a), Medicare Managed Care Manual Chapter 4"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover the requirement that MA plans cover all Original Medicare benefits,
the process for challenging coverage exclusions, and how to reference Medicare's National
Coverage Determinations (NCDs) and Local Coverage Determinations (LCDs).
```

Create `src/library/medicare_advantage/step_therapy.md`:
```markdown
---
title: "Medicare Advantage Step Therapy Protections"
summary: "Federal rules limiting when Medicare Advantage plans may require step therapy for Part B drugs."
source: "42 C.F.R. § 422.136, CMS Step Therapy Rule effective January 1, 2020"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover the 2020 CMS rule allowing MA plans to use step therapy for Part B drugs,
the required exceptions process, and how to request a step therapy exception when the
required drug has already failed or is contraindicated.
```

Create `src/library/medicare_advantage/co.md`:
```markdown
---
title: "Colorado Medicare Advantage State Protections"
summary: "Colorado-specific insurance regulations that apply alongside federal Medicare Advantage rules."
source: "Colorado Division of Insurance, Title 10 C.R.S."
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover Colorado state insurance protections that supplement federal MA rules,
including the Colorado Division of Insurance complaint process and any state-specific
appeal rights beyond the federal 42 C.F.R. Part 422 process.
```

- [ ] **Step 2: Create stub markdown files for employer_erisa**

Create `src/library/employer_erisa/prior_auth_missing.md`:
```markdown
---
title: "ERISA Prior Authorization Appeal Rights"
summary: "Federal rules governing employer plan prior authorization denials and the right to appeal."
source: "ERISA § 503, 29 C.F.R. § 2560.503-1(b)(3)"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover ERISA requirements for prior authorization procedures, the right to
appeal a prior auth denial, and the DOL's position on retrospective denials when prior
authorization was not obtained due to emergency circumstances.
```

Create `src/library/employer_erisa/experimental.md`:
```markdown
---
title: "ERISA Experimental Treatment Denial Standards"
summary: "Standards plan administrators must meet to deny coverage as experimental under ERISA."
source: "ERISA § 503, DOL Claims Procedure Regulations 29 C.F.R. § 2560.503-1"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover the evidentiary standard required for an ERISA plan to deny a claim
as experimental or investigational, the requirement that the denial cite specific plan language,
and how to challenge experimental denials using FDA approval and clinical guideline evidence.
```

Create `src/library/employer_erisa/out_of_network.md`:
```markdown
---
title: "ERISA Out-of-Network Coverage and the No Surprises Act"
summary: "Federal protections against surprise billing and out-of-network denials for employer-sponsored plans."
source: "No Surprises Act (Div. BB, Consolidated Appropriations Act 2021), 29 C.F.R. § 2590.716"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover No Surprises Act protections effective January 1, 2022, which prohibit
balance billing for emergency services and certain non-emergency services at in-network facilities,
and the independent dispute resolution process for out-of-network billing disputes.
```

Create `src/library/employer_erisa/not_covered.md`:
```markdown
---
title: "ERISA Plan Document and Coverage Exclusion Rules"
summary: "Employer plans must provide specific plan language when denying coverage — vague exclusions are challengeable."
source: "ERISA § 503, 29 C.F.R. § 2560.503-1(g), ACA Essential Health Benefits § 1302"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover the ERISA requirement that denial notices cite the specific plan provision
relied upon, the contra proferentem doctrine (ambiguous exclusions interpreted against the insurer),
and ACA essential health benefit requirements for non-grandfathered plans.
```

Create `src/library/employer_erisa/step_therapy.md`:
```markdown
---
title: "ERISA Step Therapy and Fail-First Protocol Challenges"
summary: "How to challenge step therapy requirements that force patients to try cheaper drugs before prescribed treatment."
source: "ERISA § 503, 29 C.F.R. § 2560.503-1, State step therapy exception laws"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover how to challenge step therapy protocols under ERISA, the argument that
requiring a patient to fail on a drug their doctor did not prescribe violates medical necessity
standards, and how to request a step therapy exception based on contraindication or prior failure.
```

Create `src/library/employer_erisa/nm.md`:
```markdown
---
title: "New Mexico Employer Insurance State Protections"
summary: "New Mexico insurance regulations that may apply to fully-insured employer plans."
source: "New Mexico Insurance Code, NMSA 1978, Chapter 59A"
updated: 2026
---

## Stub — Content Pending

Placeholder. Will cover New Mexico state insurance protections applicable to fully-insured
employer plans (note: self-funded ERISA plans are exempt from state law under ERISA preemption).
Includes New Mexico Insurance Division complaint process.
```

- [ ] **Step 3: Commit the stub files**

```bash
cd "c:\Users\rrd4\Documents\claude super\patient-advocate"
git add src/library/
git commit -m "feat: scaffold verified library directory with stub files"
```

---

## Task 2: Lookup engine

**Files:**
- Create: `src/library/index.js`
- Create: `src/library/index.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/library/index.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseMarkdown, lookupVerifiedFacts } from './index'

const sampleMarkdown = `---
title: "Test Title"
summary: "Test summary sentence."
source: "Test Source Manual, Sec. 1.1"
updated: 2026
---

## Test Content

This is the body of the document.`

const emptyMarkdown = `No frontmatter here, just body text.`

describe('parseMarkdown', () => {
  it('extracts frontmatter fields from valid markdown', () => {
    const { meta, body } = parseMarkdown(sampleMarkdown)
    expect(meta.title).toBe('Test Title')
    expect(meta.summary).toBe('Test summary sentence.')
    expect(meta.source).toBe('Test Source Manual, Sec. 1.1')
    expect(meta.updated).toBe('2026')
  })

  it('returns body content separately from frontmatter', () => {
    const { body } = parseMarkdown(sampleMarkdown)
    expect(body).toContain('This is the body of the document.')
    expect(body).not.toContain('title:')
  })

  it('returns empty meta and raw text when no frontmatter', () => {
    const { meta, body } = parseMarkdown(emptyMarkdown)
    expect(meta).toEqual({})
    expect(body).toBe(emptyMarkdown)
  })
})

describe('lookupVerifiedFacts', () => {
  const mockFiles = {
    './medicare_advantage/medical_necessity.md': sampleMarkdown,
    './employer_erisa/medical_necessity.md': sampleMarkdown,
    './medicare_advantage/co.md': `---
title: "Colorado Rules"
summary: "Colorado state rules."
source: "Colorado Insurance Code"
updated: 2026
---
Colorado specific content.`,
  }

  it('returns silentContext and visibleCitations for a matched file', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'medicare_advantage', denial_reason: 'medical_necessity', state: null },
      mockFiles
    )
    expect(result.silentContext).toContain('This is the body of the document.')
    expect(result.visibleCitations).toHaveLength(1)
    expect(result.visibleCitations[0].title).toBe('Test Title')
    expect(result.visibleCitations[0].summary).toBe('Test summary sentence.')
  })

  it('appends state-specific content when state file exists', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'medicare_advantage', denial_reason: 'medical_necessity', state: 'co' },
      mockFiles
    )
    expect(result.silentContext).toContain('Colorado specific content.')
    expect(result.visibleCitations).toHaveLength(2)
    expect(result.visibleCitations[1].title).toBe('Colorado Rules')
  })

  it('returns empty results when no file matches', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'medicaid', denial_reason: 'medical_necessity', state: null },
      mockFiles
    )
    expect(result.silentContext).toBe('')
    expect(result.visibleCitations).toEqual([])
  })

  it('returns empty results when plan_type is unclear', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'unclear', denial_reason: 'medical_necessity', state: null },
      mockFiles
    )
    expect(result.silentContext).toBe('')
    expect(result.visibleCitations).toEqual([])
  })

  it('returns empty results when plan_type is null', () => {
    const result = lookupVerifiedFacts(
      { plan_type: null, denial_reason: 'medical_necessity', state: null },
      mockFiles
    )
    expect(result.silentContext).toBe('')
    expect(result.visibleCitations).toEqual([])
  })

  it('includes primary match even when state file is missing', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'medicare_advantage', denial_reason: 'medical_necessity', state: 'ak' },
      mockFiles
    )
    expect(result.visibleCitations).toHaveLength(1)
    expect(result.silentContext).toContain('This is the body of the document.')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:\Users\rrd4\Documents\claude super\patient-advocate"
npm run test:run
```

Expected: FAIL — "Cannot find module './index'"

- [ ] **Step 3: Create `src/library/index.js`**

```js
// Eagerly bundle all library markdown files at build time.
// Uses Vite's import.meta.glob — no runtime network requests, works fully offline.
const LIBRARY_FILES = import.meta.glob('./**/*.md', { eager: true, query: '?raw', import: 'default' })

export function parseMarkdown(rawText) {
  const match = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: rawText }

  const meta = {}
  match[1].split('\n').forEach((line) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) return
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key) meta[key] = value
  })

  return { meta, body: match[2] }
}

// Accepts an optional _files override so tests can inject a mock file map
// without needing to mock import.meta.glob.
export function lookupVerifiedFacts({ plan_type, denial_reason, state }, _files = LIBRARY_FILES) {
  let silentContext = ''
  const visibleCitations = []

  if (!plan_type || plan_type === 'unclear') return { silentContext, visibleCitations }

  const primaryPath = `./${plan_type}/${denial_reason}.md`
  if (_files[primaryPath]) {
    const { meta, body } = parseMarkdown(_files[primaryPath])
    silentContext += `PRIMARY GROUNDING FACTS:\n${body}\n\n`
    visibleCitations.push({
      title: meta.title || `${denial_reason} Guidelines`,
      summary: meta.summary || 'Verified regulatory rules for this denial type.',
      source: meta.source || 'Official Guidelines',
      updated: meta.updated || '2026',
    })
  }

  if (state) {
    const statePath = `./${plan_type}/${state.toLowerCase()}.md`
    if (_files[statePath]) {
      const { meta, body } = parseMarkdown(_files[statePath])
      silentContext += `STATE-SPECIFIC RULES (${state.toUpperCase()}):\n${body}`
      visibleCitations.push({
        title: meta.title || `${state.toUpperCase()} State Rules`,
        summary: meta.summary || `State protections for ${state.toUpperCase()}.`,
        source: meta.source || 'State Statutes',
        updated: meta.updated || '2026',
      })
    }
  }

  return { silentContext: silentContext.trim(), visibleCitations }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run
```

Expected: PASS — all tests passing (existing + new)

- [ ] **Step 5: Commit**

```bash
git add src/library/index.js src/library/index.test.js
git commit -m "feat: add verified library lookup engine with parseMarkdown and lookupVerifiedFacts"
```

---

## Task 3: Starter content files

**Files:**
- Modify: `src/library/medicare_advantage/medical_necessity.md`
- Modify: `src/library/employer_erisa/medical_necessity.md`

- [ ] **Step 1: Write `src/library/medicare_advantage/medical_necessity.md`**

Replace the file with:

```markdown
---
title: "Medicare Advantage Medical Necessity Standards"
summary: "CMS rules requiring Medicare Advantage plans to cover services that are medically necessary — the same standard as Original Medicare."
source: "42 C.F.R. § 422.101, CMS Medicare Managed Care Manual Chapter 4, Jimmo v. Sebelius Settlement (2013)"
updated: 2026
---

## What Medicare Advantage Plans Must Cover

Under 42 C.F.R. § 422.101(a), Medicare Advantage plans are required to cover all services that Original Medicare (Parts A and B) covers. A Medicare Advantage plan cannot be more restrictive than Original Medicare in its coverage determinations.

## The Medical Necessity Standard

A service is medically necessary when it meets all of the following criteria:
- It is consistent with the diagnosis or condition being treated
- It meets accepted standards of medical practice in the United States
- It is not primarily for the convenience of the patient or provider
- It is the most appropriate service that can safely be provided

The treating physician's documented clinical judgment is the primary evidence of medical necessity. An insurance company's internal algorithm or statistical model is NOT a substitute for individualized clinical review.

## The "Improvement Standard" Is Illegal

Under the Jimmo v. Sebelius settlement (D. Vt. 2013), Medicare — and by extension Medicare Advantage plans — CANNOT deny coverage solely because a patient is not expected to improve. Coverage must be provided when skilled care is needed to maintain a patient's condition or prevent deterioration, even without improvement.

## What the Plan Must Do to Deny

To lawfully deny a claim as not medically necessary, the plan must:
1. Have its denial reviewed by a qualified physician with relevant specialty expertise
2. Cite the specific clinical criteria that were not met
3. Explain why the treating physician's documentation was insufficient
4. Provide the specific section of the Coverage Determination Policy used

A denial that was generated by an automated system without individual physician review violates 42 C.F.R. Part 422 and is grounds for overturning the denial on appeal.

## The Appeal Right

Under 42 C.F.R. § 422.562, any member whose claim is denied has the right to:
- File an Organization Determination appeal with the plan
- Request an expedited (72-hour) decision if the condition is urgent
- Request review by an Independent Review Entity (IRE) if the plan upholds the denial
- Pursue ALJ hearing, Medicare Appeals Council review, and Federal Court review

The plan must respond to a standard appeal within 30 days, or 72 hours for an expedited appeal.
```

- [ ] **Step 2: Write `src/library/employer_erisa/medical_necessity.md`**

Replace the file with:

```markdown
---
title: "ERISA Medical Necessity Appeal Rights"
summary: "Federal law requires employer health plans to give plan members a full and fair review of any medical necessity denial."
source: "ERISA § 503, 29 C.F.R. § 2560.503-1, DOL Claims Procedure Regulations"
updated: 2026
---

## What ERISA Requires

The Employee Retirement Income Security Act (ERISA) § 503 and its implementing regulations at 29 C.F.R. § 2560.503-1 require every employer-sponsored health plan to provide a full and fair review of any denied claim.

A "full and fair review" means:
- The appeal must be reviewed by someone different from the person who made the initial denial
- The reviewer must have relevant medical expertise in the area being denied
- The reviewer must consider all evidence submitted, including new evidence on appeal
- The plan cannot give deference to the initial denial — the review must be fresh and independent

## What the Denial Notice Must Contain

Under 29 C.F.R. § 2560.503-1(g), a denial notice for a medical necessity claim MUST include:
1. The specific reason(s) for the denial
2. The specific plan provision(s) or clinical criteria relied upon
3. If an internal rule, guideline, or protocol was used, it must be provided to the member free of charge
4. The right to appeal and the deadline for doing so
5. The right to an External Independent Review

If the denial notice lacks any of these elements, the denial is procedurally defective and must be overturned.

## The Right to the Complete Claim File

Under 29 C.F.R. § 2560.503-1(h)(2)(iii), you have the right to request the complete claim file — every document the plan used to make its decision — free of charge. This includes:
- The internal guideline, algorithm, or criteria used to deny the claim
- The credentials of the reviewing physician
- Any communications between the plan and its medical reviewers

Requesting the claim file is one of the most powerful first steps in any appeal.

## Medical Necessity Standard Under ERISA

ERISA does not define "medical necessity" — that definition comes from the plan document. However, courts have consistently held that:
- Plans cannot apply a medical necessity standard that is more restrictive than generally accepted medical standards
- The treating physician's documentation carries significant evidentiary weight
- An algorithmic or automated denial without physician review does not constitute a "full and fair review"

## External Independent Review

After exhausting internal appeals, you have the right to External Independent Review by an Independent Review Organization (IRO) under the ACA (for non-grandfathered plans) or applicable state law. The IRO's decision is binding on the plan.

Contact the U.S. Department of Labor's Employee Benefits Security Administration (EBSA) at 1-866-444-3272 if the plan denies your right to appeal or violates appeal deadlines.
```

- [ ] **Step 3: Run tests to confirm they still pass**

```bash
npm run test:run
```

Expected: PASS — all tests still passing

- [ ] **Step 4: Commit**

```bash
git add src/library/medicare_advantage/medical_necessity.md src/library/employer_erisa/medical_necessity.md
git commit -m "feat: add curated medical necessity content for medicare_advantage and employer_erisa"
```

---

## Task 4: FactsUsedCard component

**Files:**
- Create: `src/components/FactsUsedCard.jsx`
- Create: `src/components/FactsUsedCard.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/FactsUsedCard.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FactsUsedCard } from './FactsUsedCard'

const fakeCitations = [
  {
    title: 'Medicare Advantage Medical Necessity Standards',
    summary: 'CMS rules requiring MA plans to cover medically necessary services.',
    source: '42 C.F.R. § 422.101, CMS Medicare Managed Care Manual Chapter 4',
    updated: '2026',
  },
  {
    title: 'Colorado State Rules',
    summary: 'Colorado-specific insurance protections.',
    source: 'Colorado Insurance Code',
    updated: '2026',
  },
]

describe('FactsUsedCard', () => {
  it('renders nothing when citations array is empty', () => {
    const { container } = render(<FactsUsedCard citations={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when citations is null', () => {
    const { container } = render(<FactsUsedCard citations={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the verified sources heading', () => {
    render(<FactsUsedCard citations={fakeCitations} />)
    expect(screen.getByText(/verified sources used/i)).toBeInTheDocument()
  })

  it('renders each citation title', () => {
    render(<FactsUsedCard citations={fakeCitations} />)
    expect(screen.getByText('Medicare Advantage Medical Necessity Standards')).toBeInTheDocument()
    expect(screen.getByText('Colorado State Rules')).toBeInTheDocument()
  })

  it('renders each citation summary', () => {
    render(<FactsUsedCard citations={fakeCitations} />)
    expect(screen.getByText('CMS rules requiring MA plans to cover medically necessary services.')).toBeInTheDocument()
  })

  it('renders the privacy notice', () => {
    render(<FactsUsedCard citations={fakeCitations} />)
    expect(screen.getByText(/no private data left your device/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run
```

Expected: FAIL — "Cannot find module './FactsUsedCard'"

- [ ] **Step 3: Create `src/components/FactsUsedCard.jsx`**

```jsx
export function FactsUsedCard({ citations }) {
  if (!citations || citations.length === 0) return null

  return (
    <div style={{
      background: "rgba(0,229,160,0.05)",
      border: "1px solid rgba(0,229,160,0.25)",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: "#00e5a0", fontFamily: "monospace", marginBottom: 10 }}>
        🛡️ VERIFIED SOURCES USED
      </div>
      <p style={{ fontSize: 13, color: "rgba(232,244,240,0.65)", fontFamily: "monospace", marginBottom: 14, lineHeight: 1.5 }}>
        To prevent mistakes, this appeal was written using the following official rules:
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {citations.map((cite, i) => (
          <div key={i} style={{
            paddingBottom: i < citations.length - 1 ? 12 : 0,
            borderBottom: i < citations.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e8f4f0", fontFamily: "Georgia, serif", marginBottom: 4 }}>
              {cite.title}
            </div>
            <div style={{ fontSize: 13, color: "rgba(232,244,240,0.7)", lineHeight: 1.5, marginBottom: 4 }}>
              {cite.summary}
            </div>
            <div style={{ fontSize: 11, color: "rgba(232,244,240,0.35)", fontFamily: "monospace" }}>
              Source: {cite.source} ({cite.updated})
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: "rgba(0,229,160,0.5)", fontFamily: "monospace", marginTop: 14, marginBottom: 0 }}>
        No private data left your device to look up these rules.
      </p>
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
git add src/components/FactsUsedCard.jsx src/components/FactsUsedCard.test.jsx
git commit -m "feat: add FactsUsedCard component for visible source citations"
```

---

## Task 5: Wire into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports at the top of `src/App.jsx`**

Find the existing imports at the top of `src/App.jsx` and add:

```jsx
import { lookupVerifiedFacts } from "./lib/../library/index";
import { FactsUsedCard } from "./components/FactsUsedCard";
```

Note: the import path from `src/App.jsx` to `src/library/index.js` is `"./library/index"`.

- [ ] **Step 2: Add `visibleCitations` state**

Find the state declarations in `InsuranceFighter` and add:

```jsx
const [visibleCitations, setVisibleCitations] = useState([]);
```

Place it alongside the other letter-related state variables (near `letters`, `activeTab`, `generating`).

- [ ] **Step 3: Clear citations on reset**

Find the `reset()` function and add:

```jsx
setVisibleCitations([]);
```

alongside the other state resets.

- [ ] **Step 4: Call `lookupVerifiedFacts` in `generateLetter`**

Find this line in `generateLetter`:

```jsx
const legalFramework = buildLegalFramework(planType);
const denialReasonKey = confirmedExtraction?.denial_reason || "medical_necessity";
const template = loadTemplate(planType, denialReasonKey);
```

Add after those three lines:

```jsx
const { silentContext, visibleCitations: citations } = lookupVerifiedFacts({
  plan_type: planType,
  denial_reason: confirmedExtraction?.denial_reason || "medical_necessity",
  state: confirmedExtraction?.state || null,
});
setVisibleCitations(citations);
```

- [ ] **Step 5: Inject `silentContext` into the insurance appeal prompt**

Find this section in the `insurancePrompt` string:

```jsx
${templateSection}

INSTRUCTIONS:
```

Replace it with:

```jsx
${templateSection}

${silentContext ? `VERIFIED FACTS — answer ONLY from these documents, not from training memory. If a needed fact is not here, write [VERIFY: ___] rather than guessing:\n\n${silentContext}\n` : ""}
INSTRUCTIONS:
```

- [ ] **Step 6: Render `FactsUsedCard` on the letter results screen**

Find the letter step section — specifically this line:

```jsx
{!generating && letters.insurance && (
```

Add `FactsUsedCard` immediately before the tabs, inside that block:

```jsx
{!generating && letters.insurance && (
  <>
    <FactsUsedCard citations={visibleCitations} />
    {/* Tabs */}
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
```

- [ ] **Step 7: Build to verify no errors**

```bash
cd "c:\Users\rrd4\Documents\claude super\patient-advocate"
npm run build
```

Expected: clean build, no errors

- [ ] **Step 8: Run all tests**

```bash
npm run test:run
```

Expected: PASS — all tests passing

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire verified library into letter generation — silent injection + FactsUsedCard"
```

---

## Task 6: Push and manual verification

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Test with the sample denial letter**

1. Open `http://localhost:5173` in your browser
2. Upload the `sample_denial_letter.pdf` (Meridian Health Assurance — Pembrolizumab denial)
3. After extraction, confirm the plan type in the confirmation card
4. Click "Looks Right — Draft My Appeal"
5. On the letter results screen, verify the **🛡️ VERIFIED SOURCES USED** card appears
6. Verify the card shows the title, summary, and source citation
7. Verify "No private data left your device" is visible

- [ ] **Step 4: Verify the letter content cites sources correctly**

Read the generated insurance appeal letter. Confirm:
- It references specific sections from the verified facts (e.g., 42 C.F.R. § 422.101 for Medicare Advantage, or ERISA § 503 for employer plans)
- It does NOT cite laws from the wrong framework (no ERISA on a Medicare denial)
- Any fact not in the documents appears as `[VERIFY: ___]` rather than a hallucinated value
