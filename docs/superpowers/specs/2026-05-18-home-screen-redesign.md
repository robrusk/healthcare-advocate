# Home Screen Redesign — Two Entry Points

**Date:** 2026-05-18
**Scope:** Replace single denial-letter-focused home screen with two distinct entry points: Fight a Denial and Review a Bill.

---

## Problem

The current home screen says "Fight Your Denial. Win Your Claim." and uses denial-letter language throughout — even when the user is uploading a medical bill. The UX is misaligned with the app's expanded scope.

---

## Design

### Header (top of screen)

```
🛡️ healthcareadvocate.org    ← font-size: 17px (30% increase from 13px), letterSpacing: 4
We're on your side.           ← tagline, unchanged
Free help fighting insurance denials and surprise medical bills.  ← new subheadline
```

### Two Equal Cards

Side-by-side, equal size, each with its own color and upload button.

**Card 1 — Fight a Denial (red)**
- Border/glow color: `#ff3c3c`
- Icon + heading: `⚔️ Fight a Denial`
- Body copy: "Insurance denied your claim? You have a deadline. Let's fight back."
- Button: `📷 Snap or Upload Denial Letter`
- On button tap: sets `documentType = 'denial_letter'`, opens file picker

**Card 2 — Review a Bill (teal)**
- Border/glow color: `#00e5a0`
- Icon + heading: `🧾 Review a Bill`
- Body copy: "Got a medical bill? Don't pay until we check it."
- Button: `📷 Snap or Upload Medical Bill`
- On button tap: sets `documentType = 'medical_bill'`, opens file picker

### Fallback Link (below cards)

`Not sure what you have? Tap here and we'll figure it out.`

- Small, centered, muted text — not a button
- Tap opens file picker WITHOUT setting `documentType`
- Existing AI auto-detection flow handles classification (sets `documentType` from `result.document_type`)

---

## Behavior Changes

### documentType bypass
Tapping either card's upload button sets `documentType` directly from the card choice — skips AI classification entirely. Faster, cheaper, zero misclassification risk.

The fallback link preserves the existing AI-detection path for users who genuinely don't know.

### Step tracker
After a card is tapped and a document uploaded, `currentSteps` already updates based on `documentType`. No changes needed to step tracker logic.

### Existing flows unchanged
The denial letter flow and bill review flow are unaffected. This redesign only changes the upload step UI.

---

## Files to Change

| File | Change |
|------|--------|
| `src/App.jsx` | Replace upload screen header + single button with two-card layout + fallback link |

No new files needed. The two card upload buttons reuse the same `handlePhoto` logic — the only difference is `documentType` is pre-set before `handlePhoto` is called.

---

## Implementation Notes

**Pre-set documentType before handlePhoto:**
Each card button calls a new inline handler that sets `documentType` first, then triggers the file input:

```jsx
// Denial card button
onClick={() => {
  setDocumentType('denial_letter');
  document.getElementById('camera-input').click();
}}

// Bill card button  
onClick={() => {
  setDocumentType('medical_bill');
  document.getElementById('camera-input-bill').click();
}}

// Fallback link
onClick={() => {
  setDocumentType(null); // let AI detect
  document.getElementById('camera-input-auto').click();
}}
```

Three separate hidden file inputs to avoid click conflicts. Each uses `accept="image/*,.pdf"` and `onChange={handlePhoto}`.

**Header font size:** `fontSize: 17` (was 13, +30%)

**Card styling:** dark background (`rgba(255,255,255,0.03)`), colored border and glow matching card theme color, identical dimensions.

---

## Out of Scope

- Changes to denial letter flow
- Changes to bill review flow  
- Changes to step tracker logic
- The "Charges to Question" summary feature (separate spec)
