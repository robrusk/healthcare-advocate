# Healthcare Advocate
**healthcareadvocate.org** — Free help fighting insurance denials and surprise medical bills.

A nonprofit volunteer project. No ads. No upsells. No subscriptions.

---

## What It Does

Families upload a photo or PDF of a health insurance denial letter or a medical bill. The app reads it using AI, explains it in plain English written for a 75-year-old with no medical background, and generates ready-to-send dispute letters — legally grounded, specific to the plan type, and harder to ignore than a polite phone call.

**Denial letter flow:** Photo/PDF → plain-English explanation → editable confirmation card → battle plan → three letters (insurance appeal, hospital, doctor support)

**Medical bill flow:** Photo/PDF → plain-English explanation → line items with flags → itemized bill request letter → optional billing error dispute letter (when biller error is detected)

---

## Tech Stack

- **React 18 + Vite 8** — Single-page app, deployed as a PWA
- **Cloudflare Worker** — Proxies all Claude API calls; API key never reaches the browser
- **Anthropic Claude API** — Haiku for extraction (cheap/fast), Opus for letter generation
- **Vitest + @testing-library/react** — 60 tests

---

## Architecture

### Two-Pass AI (the most important design decision)

The app uses a two-pass architecture to prevent legal framework hallucination. A single "write me an appeal letter" prompt can generate letters that cite ERISA on a Medicare denial — which gets the appeal dismissed immediately.

**Pass 1 — Extraction (Haiku):** Reads the document and returns structured JSON: plan type, denial reason, deadline, state, confidence per field. Fast, cheap, no letter writing.

**Pass 2 — Human confirmation:** The user reviews and corrects the extracted facts before any letter is written. Low-confidence fields are flagged yellow. Plan type is the critical field — users always know if they have employer/Medicare/Medicaid insurance.

**Pass 3 — Template-guided generation (Opus):** Receives confirmed structured inputs + a plan-specific legal framework from `src/lib/planRoutes.js` + a vetted letter template from `src/templates/`. The model adapts the template — it does not invent legal citations.

### Legal Framework Routing

`src/lib/planRoutes.js` maps plan types to governing law and appeal paths:

| Plan Type | Governing Law |
|-----------|--------------|
| `employer_erisa` | ERISA § 503, 29 C.F.R. § 2560.503-1 |
| `medicare_advantage` | 42 C.F.R. Part 422, Subpart M |
| `original_medicare` | 42 C.F.R. Part 405, Subpart I |
| `medicaid` | State Fair Hearing (never cite ERISA) |
| `aca_marketplace` | 45 C.F.R. § 147.136 |
| `fehb` | 5 C.F.R. § 890.105 |
| `unclear` | Block generation — force user to clarify |

### Verified Library (Layer 3 — on-device RAG)

`src/library/` contains curated excerpts from official sources (CMS, ERISA.gov). When a letter is generated, the relevant document is silently injected into the prompt as "Verified Facts." The model is instructed to answer only from those documents, not from training memory.

A "🛡️ Verified Sources Used" card shows the user exactly which documents were consulted.

### Cloudflare Worker

All Claude API calls go through a Cloudflare Worker proxy at `icy-silence-e717.rob-3ea.workers.dev`. The Anthropic API key lives in the Worker's encrypted environment — it never appears in the browser bundle.

---

## Project Structure

```
src/
├── App.jsx                    # Main component — all UI state and flow logic
├── lib/
│   ├── claude.js              # All Claude API calls (analyzePhoto, analyzeDenial, analyzeMedicalBill)
│   ├── planRoutes.js          # Legal framework routing table + template loader
│   └── calendar.js            # .ics file generator for appeal deadlines
├── components/
│   ├── BillReviewScreen.jsx   # Medical bill line items, flags, biller error warning
│   └── FactsUsedCard.jsx      # Verified sources citation card
├── templates/                 # Vetted letter structure templates per plan/denial type
│   ├── employer_erisa/
│   ├── medicare_advantage/
│   └── ...
└── library/                   # On-device RAG — curated official document excerpts
    ├── index.js               # Lookup engine (lookupVerifiedFacts)
    ├── employer_erisa/
    ├── medicare_advantage/
    └── ...
```

---

## Local Development

```bash
# Install dependencies
npm install

# Create .env with your Anthropic API key
echo "VITE_ANTHROPIC_API_KEY=sk-ant-..." > .env

# Start dev server (localhost:5173)
npm run dev

# Expose on local network for mobile testing
npm run dev -- --host

# Run tests
npm run test:run

# Build for production
npm run build
```

**Note:** The `.env` file is gitignored. Never commit API keys. In production, the key lives in the Cloudflare Worker, not in the app bundle.

---

## Deployment

1. Run `npm run build` → creates `dist/`
2. Upload contents of `dist/` to server root via FileZilla (or any FTP client)
3. The app is a PWA — users can install it from the browser on any device

**DNS:** `healthcareadvocate.org` is registered through Cloudflare Registrar and proxied through Cloudflare CDN. SSL is automatic.

**Hosting:** Traditional shared hosting at ruskracing.com server (64.4.162.10).

---

## Key Design Decisions

**Why not a native iOS app?** PWA installs from the browser, no App Store needed. Works on iPhone, Android, and desktop from one codebase.

**Why Cloudflare Worker?** API key security. The browser bundle is public — putting a key there exposes it. The Worker holds the key server-side.

**Why templates instead of raw prompts?** The template library is the nonprofit's core intellectual asset. It contains vetted legal language reviewed against actual regulations. The AI adapts the structure — it doesn't invent citations.

**Why show the "Verified Sources" card?** Trust. A 75-year-old fighting an insurance company needs to know the app is grounded in real rules, not AI guesswork. Showing sources transforms "black box" into "credible partner."

---

## Governance

This project is being incorporated as a 501(c)(3) nonprofit. The founding bylaws will include a mission-lock clause:
- Patients first, always
- Free forever for the family
- No advertising, no data selling, no conflicts of interest

---

## Contact

office@healthcareadvocate.org
