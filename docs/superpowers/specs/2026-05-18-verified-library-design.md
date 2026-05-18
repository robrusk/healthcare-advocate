# Verified Library (Layer 3) Design

**Date:** 2026-05-18
**Scope:** On-device RAG — grounding AI letter generation in verified official documents

---

## Problem

The AI generates letters from training memory, which may be 1–2 years stale. In a high-stakes environment (insurance appeals, Medicare, SSA benefits), a wrong rule, wrong deadline, or wrong benefit amount hurts real people. The two-pass architecture (Layers 1–2) already prevents wrong legal frameworks. Layer 3 prevents wrong facts.

---

## Solution

A curated, on-device document library. When a letter is generated, the system silently injects relevant fact content into the prompt AND shows the user a visible "Facts Used" card naming the exact sources consulted. The AI is instructed to answer only from those documents — not from training memory.

---

## Architecture

Three existing layers plus the new one:

| Layer | File | Purpose |
|-------|------|---------|
| 1 | `src/lib/planRoutes.js` | Legal framework routing — which laws apply |
| 2 | `src/templates/` | Vetted letter structure per plan/denial type |
| **3** | **`src/library/`** | **Verified facts — official document excerpts** |

Layer 3 slots in after user confirmation (Pass 2) and before letter generation (Pass 3).

---

## File Structure

```
src/library/
├── index.js                          ← Lookup engine
├── medicare_advantage/
│   ├── medical_necessity.md          ← Real content (starter)
│   ├── prior_auth_missing.md         ← Stub
│   ├── experimental.md               ← Stub
│   ├── out_of_network.md             ← Stub
│   ├── not_covered.md                ← Stub
│   ├── step_therapy.md               ← Stub
│   └── co.md                         ← Stub (Colorado state rules)
└── employer_erisa/
    ├── medical_necessity.md          ← Real content (starter)
    ├── prior_auth_missing.md         ← Stub
    ├── experimental.md               ← Stub
    ├── out_of_network.md             ← Stub
    ├── not_covered.md                ← Stub
    ├── step_therapy.md               ← Stub
    └── nm.md                         ← Stub (New Mexico state rules)
```

Additional plan type directories (`aca_marketplace/`, `original_medicare/`, `medicaid/`, `fehb/`) are added as content is curated.

---

## Markdown Frontmatter Schema

Every library file has a YAML frontmatter block followed by the curated fact content:

```markdown
---
title: "Short display title for the Facts Used card"
summary: "One sentence shown to the user — what this document covers."
source: "Official document name, section, and year"
updated: 2026
---

Full curated content here...
```

**Rules for content authors:**
- Extract only from official sources (CMS, SSA, ERISA.gov, state insurance code)
- Include the specific section number for every rule cited
- Update the `updated` field when content is refreshed
- Keep body under ~800 words — enough context for the AI, not so much it drowns the prompt

---

## Lookup Engine (`src/library/index.js`)

Uses `import.meta.glob` — same pattern as the template library, zero new dependencies.

**Lookup keys (in order):**
1. `{plan_type}/{denial_reason}.md` — primary match
2. `{plan_type}/{state}.md` — state-specific addendum (optional)

**Key values come from `confirmedExtraction`**, which uses normalized enum values from `analyzeDenial()`:
- `plan_type`: `employer_erisa | aca_marketplace | medicare_advantage | original_medicare | medicaid | fehb`
- `denial_reason`: `medical_necessity | experimental | out_of_network | not_covered | prior_auth_missing | step_therapy | other`
- `state`: 2-letter lowercase code (e.g., `co`, `nm`)

Raw billing codes (CO-50, etc.) are already normalized to enum values by Pass 1 — the library never sees raw codes.

**Failure mode:** If no file matches, `silentContext` is empty and `visibleCitations` is `[]`. Letter generation continues without library injection. The Facts Used card simply does not render.

**Returns:**
```js
{
  silentContext: string,     // Full document body for prompt injection
  visibleCitations: [        // For the visible UI card
    {
      title: string,
      summary: string,
      source: string,
      updated: number
    }
  ]
}
```

---

## Prompt Integration

The `silentContext` is injected into the insurance appeal prompt with an explicit instruction:

```
VERIFIED FACTS (official source documents — use ONLY these facts, not your training memory):
{silentContext}

INSTRUCTION: Base all factual claims in this letter on the verified facts above.
If a needed fact is not in the verified documents, write [VERIFY: ___] rather than guessing.
```

This is injected after the legal framework block and before the template block.

---

## UI Component (`FactsUsedCard`)

Appears on the letter results screen, above the letter tabs, only when `visibleCitations.length > 0`.

**Visual design (adapted for the app's dark theme):**
- Dark card with teal/green accent border
- Header: "🛡️ Verified Sources Used"
- Subheader: "To prevent mistakes, this appeal was written using the following official rules:"
- Each citation: title (bold), summary (readable), source + year (small, muted)
- Footer: "No private data left your device to look up these rules."

**Why visible matters:**
- Transforms "black box AI" into "credible partner" for a skeptical senior audience
- Gives non-profit partners and their legal teams audit confidence
- Enables the "print and bring to the doctor" use case — doctor sees the citation, not just an AI letter

---

## Starter Content: `medicare_advantage/medical_necessity.md`

Full, curated content based on CMS National Coverage Determinations and 42 C.F.R. Part 422.

## Starter Content: `employer_erisa/medical_necessity.md`

Full, curated content based on ERISA § 503, 29 C.F.R. § 2560.503-1, and DOL guidance.

---

## Out of Scope

- Vector search / embeddings (Approach 2) — not needed; normalized keys make exact lookup sufficient
- Runtime PDF downloading from government sites — adds fragility and network dependency
- A backend or database — zero server, everything bundled at build time

---

## Success Criteria

1. For `plan_type: medicare_advantage` + `denial_reason: medical_necessity`, the letter prompt receives the verified facts document
2. The Facts Used card renders with the correct title, summary, and source citation
3. If no library file matches, generation continues normally with no error
4. The prompt instruction prevents the model from citing facts outside the provided documents
