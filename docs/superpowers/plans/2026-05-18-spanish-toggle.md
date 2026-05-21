# Spanish Language Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add EN/ES language toggle. Spanish UI + Spanish AI explanations + English letters (for submission) + "Leer en Español" button to read any letter in Spanish on demand.

**Architecture:** Single translation file `src/i18n/es.js` — all Spanish strings in one place. App uses `tr(key, englishFallback)` helper. AI prompts get a `language` param. Letters generated in English always; separate on-demand translation call for the "Leer en Español" button.

**Tech Stack:** React state, existing Claude API via Cloudflare Worker, no new dependencies.

**Tonal notes for Spanish copy:**
- "Apela una Denegación" NOT "Combate una Denegación" (avoid militarized framing)
- "Tienes Derechos" — softer urgency, deadline emphasis stays
- "Revisa tu Factura" for bill card (neutral)
- Letters stay English — submitted to US insurers

---

### Task 1: Create `src/i18n/es.js`

**Files:**
- Create: `src/i18n/es.js`

- [ ] **Step 1: Create the translation file**

```js
// src/i18n/es.js
// All Spanish UI strings in one place.
// When your Spanish-speaking contact has corrections, edit this file only.

const es = {
  // Header
  tagline: 'Estamos de tu lado.',
  subheadline: 'Ayuda gratuita para disputar denegaciones de seguro y facturas médicas sorpresa.',

  // Step tracker
  stepUpload: 'Escanear',
  stepAnalysis: 'Análisis IA',
  stepStrategy: 'Plan de Acción',
  stepLetter: 'Carta de Apelación',
  stepScanBill: 'Escanear Factura',
  stepBillReview: 'Revisar Factura',
  stepDisputeLetters: 'Cartas de Disputa',

  // Home screen — Fight a Denial card
  denialCardTitle: 'Apela una Denegación',
  denialCardBody: '¿Tu seguro negó tu reclamación?\nTienes derechos.\nActúa antes de que venza el plazo.',
  denialCardButton: '📷 Tomar foto o subir carta',

  // Home screen — Review a Bill card
  billCardTitle: 'Revisa tu Factura',
  billCardBody: '¿Tienes una factura médica? No pagues hasta que la revisemos juntos.',
  billCardButton: '📷 Tomar foto o subir factura',

  // Home screen — fallback link
  fallbackLink: '¿No sabes qué tienes? Toca aquí y lo averiguamos.',

  // Why This Exists
  whyHeading: '📖 POR QUÉ EXISTE ESTO',
  whyP1: 'Este sitio fue creado por un cuidador que vio a sus padres — y a demasiadas otras familias — sepultados bajo cartas de denegación y facturas médicas confusas que no tenían el tiempo, la energía ni los conocimientos para disputar.',
  whyP2: 'El sistema de salud apuesta a que te rindes. La mayoría lo hace. La tasa de éxito cuando los pacientes realmente apelan las denegaciones es alrededor del 50% — pero solo alrededor del 1% de las denegaciones son apeladas.',
  whyP3: 'Esta herramienta existe para cerrar esa brecha. Es gratuita, operada como un proyecto voluntario, no un negocio. Sin anuncios. Sin ventas adicionales. Sin suscripciones. Si te ayuda, compártela con alguien que la necesite.',
  whyItalic: 'Creado por una persona real que ha pasado por esto. No es asesoramiento legal — pero es un verdadero punto de partida.',
  privacyLink: '🔒 Tu privacidad — cómo manejamos tus datos',

  // Form — who is submitting
  whoSubmittingDenial: '¿QUIÉN PRESENTA ESTA APELACIÓN?',
  whoHandlingBill: '¿QUIÉN SE ENCARGA DE ESTO?',
  relPatient: 'El Paciente',
  relSpouse: 'Cónyuge / Pareja',
  relAdultChild: 'Hijo/a Adulto/a',
  relFamily: 'Otro Familiar',
  relAdvocate: 'Cuidador / Defensor',
  labelYourName: 'Tu Nombre',
  labelYourPhone: 'Tu Teléfono',
  labelYourEmail: 'Tu Correo Electrónico',

  // Form — denial fields
  labelPatientName: 'Nombre del Paciente',
  labelClaimNumber: 'Número de Reclamación',
  labelInsuranceCompany: 'Compañía de Seguro',
  labelTreatment: 'Tratamiento / Servicio',
  labelDenialReason: 'Razón de Denegación *',
  labelPasteLetter: 'Pegar texto de la carta (opcional)',
  pastePlaceholder: 'Pega el texto de tu carta de denegación aquí para un mejor análisis...',

  // Reading / summary states
  readingLetter: 'Leyendo tu carta...',
  readingBill: 'Leyendo tu factura...',
  whatLetterSays: '📋 QUÉ DICE TU CARTA',
  whatBillIsFor: '📋 ¿PARA QUÉ ES ESTA FACTURA?',
  fieldsFromLetter: 'Los campos a continuación se llenaron desde tu carta — revisa y corrige lo que se vea incorrecto.',
  fieldsFromBill: 'Los campos a continuación se llenaron desde tu factura — revisa y corrige lo que se vea incorrecto.',

  // Analyze buttons
  analyzeDenialBtn: '🔍 Analizar Mi Denegación →',
  analyzeBillBtn: '🔍 Analizar Esta Factura →',

  // Analyzing screen
  scanningTitle: '🤖 Analizando...',
  scanningSubtitle: 'Leyendo entre líneas',
  scanMsg1: 'Identificando el tipo de denegación...',
  scanMsg2: 'Localizando las leyes aplicables...',
  scanMsg3: 'Encontrando debilidades en el sistema del seguro...',
  scanMsg4: 'Construyendo tu plan de acción...',

  // Confirm card
  confirmTitle: '📋 Confirma Lo Que Encontramos',
  confirmSubtitle: 'Corrige cualquier error antes de redactar tus cartas',
  labelPlanType: 'Tipo de Plan',
  planTypeHint: 'Esto determina qué leyes te protegen. Por favor confirma.',
  labelDenialReasonConf: 'Razón de Denegación',
  labelAppealLevel: 'Nivel de Apelación',
  labelAppealDeadline: 'Fecha Límite de Apelación',
  labelInsurerConf: 'Compañía de Seguro',
  labelServiceDenied: 'Servicio / Tratamiento Denegado',
  labelState: 'Estado',
  lowConfWarning: '⚠ los campos amarillos tuvieron baja confianza — por favor revisa antes de continuar.',

  // Battle plan
  battlePlanTitle: '⚔️ Tu Plan de Acción',
  appealSuccessLabel: 'PROBABILIDAD DE ÉXITO EN APELACIÓN',
  timelineLabel: 'Tiempo estimado:',
  howTheirAI: 'CÓMO FUNCIONA SU IA EN TU CONTRA',
  magicKeywords: '🔑 PALABRAS CLAVE (úsalas en tu apelación)',
  lawsProtecting: '⚖️ LEYES QUE TE PROTEGEN',
  actionSteps: '📋 PASOS A SEGUIR (hazlos AHORA)',
  draftLetterBtn: '✉️ Se Ve Bien — Redactar Mi Apelación →',

  // Letter screen
  lettersTitle: '✉️ Tus Cartas',
  lettersSubtitle: 'Tres cartas listas para enviar — toca una pestaña para cambiar',
  generatingLetters: 'Redactando las tres cartas a la vez...',
  generatingLettersSub: 'Apelación al seguro · Hospital · Doctor',
  tabInsurance: '🏛 Apelación al Seguro',
  tabHospital: '🏥 Hospital',
  tabDoctor: '👨‍⚕️ Doctor',
  copyLetter: '📋 Copiar Carta',
  copied: '✓ ¡Copiado!',
  regenerateAll: '🔄 Regenerar Todo',
  addCalendar: '📅 Agregar Fecha Límite al Calendario',
  afterSendingTitle: '⚠️ DESPUÉS DE ENVIAR TUS CARTAS',
  afterSending1: 'Envía por correo certificado Y fax — crea un rastro de papel',
  afterSending2: 'Anota la fecha — los aseguradores tienen plazos estrictos de respuesta',
  afterSending3: 'Si te deniegan de nuevo → solicita Revisión Independiente Externa (gratis)',
  afterSending4: 'Presenta una queja ante tu Comisionado Estatal de Seguros',
  afterSending5: 'Último recurso: contacta a RRHH / departamento de beneficios de tu empleador (para planes grupales)',
  startNewAppeal: '← Iniciar Nueva Apelación',

  // Letter translation toggle
  readInSpanish: '🌐 Leer en Español',
  readInEnglish: '🌐 Read in English',
  translatingLetter: 'Traduciendo...',

  // Bill letters screen
  disputeLettersTitle: '✉️ Tus Cartas de Disputa',
  disputeLettersSubtitle: 'Listas para enviar — revisa y edita antes de enviar',
  generatingBillingLetters: 'Redactando tus cartas de disputa...',
  tabItemized: '📄 Solicitud de Factura Detallada',
  tabBillerError: '🚨 Disputa de Error de Facturación',
  copyBillingLetter: '📋 Copiar Carta',
  regenerateBilling: '🔄 Regenerar',
  startOver: '← Empezar de Nuevo',

  // Footer
  footerDisclaimer: 'healthcareadvocate.org — No es asesoramiento legal. Consulta a un abogado de salud para casos complejos.',

  // BillReviewScreen
  billingDept: '📞 DEPARTAMENTO DE FACTURACIÓN',
  callBillingDept: 'Llama al número de tu factura y pide el Departamento de Facturación.',
  billerErrorTitle: '🚨 ERROR DE FACTURACIÓN - PUEDE QUE NO SEAS RESPONSABLE',
  billerErrorNote: 'Si el facturador envió la reclamación a la compañía de seguro equivocada o perdió el plazo de presentación, legalmente no estás obligado a pagar su error. La carta de disputa a continuación aborda esto.',
  chargesLabel: 'CARGOS',
  noBillingCode: 'Sin código de facturación',
  missingInfoTitle: '⚠ ESTA FACTURA NO TIENE LA INFORMACIÓN REQUERIDA',
  generateDisputeLetters: '✉️ Generar Cartas de Disputa →',
  switchToDenialFlow: 'Cambiar al flujo de carta de denegación',
  flagMissingCode: 'Sin código',
  flagVague: 'Descripción vaga',
  flagDuplicate: 'Posible duplicado',
  flagBillerError: 'Posible error del facturador',

  // FactsUsedCard
  verifiedSourcesTitle: '🛡️ FUENTES VERIFICADAS USADAS',
  verifiedSourcesBody: 'Para evitar errores, esta apelación fue redactada usando las siguientes reglas oficiales:',
  verifiedSourcesFooter: 'Ningún dato privado salió de tu dispositivo para buscar estas reglas.',
}

export default es
```

- [ ] **Step 2: Verify file is syntactically valid**

```bash
node -e "require('./src/i18n/es.js')" 
```
Or just visually confirm no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/es.js
git commit -m "feat: add Spanish translation strings"
```

---

### Task 2: Wire language toggle into App.jsx

**Files:**
- Modify: `src/App.jsx` (header section + imports + state)

Context: App.jsx is ~1450 lines. The header is around lines 667–677. The component declaration is at line 282. Do NOT replace all English strings yet — just wire the state and helper.

- [ ] **Step 1: Add lang state + tr helper + es import at the top of InsuranceFighter**

After the existing imports at the top of the file, add:
```js
import es from './i18n/es'
```

Inside `InsuranceFighter()`, after the existing useState declarations, add:
```js
const [lang, setLang] = useState('en')
const tr = (key, english) => (lang === 'es' && es[key]) ? es[key] : english
```

- [ ] **Step 2: Add EN/ES toggle button to the header**

Find the header section (around line 667, the `<div style={{ textAlign: "center", padding: "32px 0 24px" ...}}>`) and add the toggle button after the `<p>` subheadline tag and before the closing `</div>`:

```jsx
<div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginTop: 14 }}>
  {['en', 'es'].map((l) => (
    <button
      key={l}
      onClick={() => setLang(l)}
      style={{
        background: lang === l ? 'rgba(0,229,160,0.15)' : 'transparent',
        border: `1px solid ${lang === l ? '#00e5a0' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: l === 'en' ? '6px 0 0 6px' : '0 6px 6px 0',
        padding: '5px 14px', cursor: 'pointer',
        color: lang === l ? '#00e5a0' : 'rgba(232,244,240,0.4)',
        fontSize: 12, fontFamily: 'monospace', fontWeight: lang === l ? 700 : 400,
        transition: 'all 0.2s',
      }}
    >{l.toUpperCase()}</button>
  ))}
</div>
```

- [ ] **Step 3: Pass `lang` to BillReviewScreen and FactsUsedCard**

Find the BillReviewScreen usage (around line 982) and add `lang={lang}`:
```jsx
<BillReviewScreen bill={billExtraction} onGenerate={generateBillingLetters} onSwitch={...} lang={lang} />
```

Find FactsUsedCard usage (around line 1250) and add `lang={lang}`:
```jsx
<FactsUsedCard citations={visibleCitations} lang={lang} />
```

- [ ] **Step 4: Confirm app still renders, toggle appears, clicking EN/ES does not crash**

Run: `npm run dev` and open localhost:5173. Toggle should appear as a small pill under the tagline.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire language toggle state and tr() helper"
```

---

### Task 3: Replace strings in App.jsx — home screen + form

**Files:**
- Modify: `src/App.jsx`

Context: Replace hardcoded strings with `tr(key, 'English fallback')`. English fallback is always the exact current string — no behavior change when lang === 'en'.

- [ ] **Step 1: Replace header strings**

Line ~671 `"We're on your side."` → `{tr('tagline', "We're on your side.")}`
Line ~674 `"Free help fighting insurance denials..."` → `{tr('subheadline', 'Free help fighting insurance denials and surprise medical bills.')}`

- [ ] **Step 2: Replace step tracker labels**

The `currentSteps` array uses hardcoded labels. Replace:
```js
const currentSteps = documentType === 'medical_bill'
  ? [
      { id: "upload", label: tr('stepScanBill', 'Scan Bill'), icon: "📄" },
      { id: "analyze", label: tr('stepAnalysis', 'AI Analysis'), icon: "🔍" },
      { id: "bill_review", label: tr('stepBillReview', 'Bill Review'), icon: "🧾" },
      { id: "bill_letters", label: tr('stepDisputeLetters', 'Dispute Letters'), icon: "✉️" },
    ]
  : [
      { id: "upload", label: tr('stepUpload', 'Scan Denial'), icon: "📄" },
      { id: "analyze", label: tr('stepAnalysis', 'AI Analysis'), icon: "🔍" },
      { id: "strategy", label: tr('stepStrategy', 'Battle Plan'), icon: "⚔️" },
      { id: "letter", label: tr('stepLetter', 'Appeal Letter'), icon: "✉️" },
    ]
```

Note: `currentSteps` references `tr` which is defined inside the component, so this works fine.

Also update the static `STEPS` const (lines 77–82) — actually, since `currentSteps` now overrides STEPS for both flows, STEPS can be left as-is or updated to match. Simplest: replace `currentSteps` entirely and leave STEPS as the English fallback (it's only used as default for `currentSteps`).

- [ ] **Step 3: Replace home screen card strings**

Fight a Denial card (~line 729):
- `"Fight a Denial"` → `{tr('denialCardTitle', 'Fight a Denial')}`
- `"Insurance denied your claim?..."` multi-line → split with `{tr('denialCardBody', 'Insurance denied your claim?').split('\n').map((l,i) => <span key={i}>{l}{i<2&&<br/>}</span>)}`
- `"📷 Snap or Upload Denial Letter"` → `{tr('denialCardButton', '📷 Snap or Upload Denial Letter')}`

Review a Bill card (~line 760):
- `"Review a Bill"` → `{tr('billCardTitle', 'Review a Bill')}`
- `"Got a medical bill? Don't pay until we check it."` → `{tr('billCardBody', "Got a medical bill? Don't pay until we check it.")}`
- `"📷 Snap or Upload Medical Bill"` → `{tr('billCardButton', '📷 Snap or Upload Medical Bill')}`

Fallback link (~line 794):
- `"Not sure what you have? Tap here and we'll figure it out."` → `{tr('fallbackLink', "Not sure what you have? Tap here and we'll figure it out.")}`

Why This Exists section (~lines 803–820):
- `"📖 WHY THIS EXISTS"` → `{tr('whyHeading', '📖 WHY THIS EXISTS')}`
- Each paragraph → `{tr('whyP1', '...')}` etc.
- Italic line → `{tr('whyItalic', '...')}`
- Privacy link text → `{tr('privacyLink', '🔒 Your privacy — how we handle your data')}`

- [ ] **Step 4: Replace form strings**

`'WHO IS HANDLING THIS?' / 'WHO IS SUBMITTING THIS APPEAL?'` (~line 836):
```jsx
{documentType === 'medical_bill' ? tr('whoHandlingBill', 'WHO IS HANDLING THIS?') : tr('whoSubmittingDenial', 'WHO IS SUBMITTING THIS APPEAL?')}
```

Relationship buttons (~lines 839–844):
```js
[
  { id: "patient", label: tr('relPatient', 'The Patient') },
  { id: "spouse", label: tr('relSpouse', 'Spouse / Partner') },
  { id: "adult_child", label: tr('relAdultChild', 'Adult Child') },
  { id: "family", label: tr('relFamily', 'Other Family') },
  { id: "advocate", label: tr('relAdvocate', 'Caregiver / Advocate') },
]
```

Field labels (~lines 856–861):
- `"Your Name"` → `{tr('labelYourName', 'Your Name')}`
- `"Your Phone"` → `{tr('labelYourPhone', 'Your Phone')}`
- `"Your Email"` → `{tr('labelYourEmail', 'Your Email')}`
- `"Patient Name"` → `{tr('labelPatientName', 'Patient Name')}`
- `"Claim Number"` → `{tr('labelClaimNumber', 'Claim Number')}`
- `"Insurance Company"` → `{tr('labelInsuranceCompany', 'Insurance Company')}`
- `"Treatment / Service"` → `{tr('labelTreatment', 'Treatment / Service')}`

Denial reason label (~line 902): `"Denial Reason *"` → `{tr('labelDenialReason', 'Denial Reason *')}`

Paste letter label (~line 927): `"Paste Denial Letter Text (optional)"` → `{tr('labelPasteLetter', 'Paste Denial Letter Text (optional)')}`
Textarea placeholder → `{tr('pastePlaceholder', 'Paste the text from your denial letter...')}`

Reading state (~line 869): `'Reading your bill...' / 'Reading your letter...'` →
```jsx
{documentType === 'medical_bill' ? tr('readingBill', 'Reading your bill...') : tr('readingLetter', 'Reading your letter...')}
```

Summary label (~line 878): same pattern for `'📋 WHAT THIS BILL IS FOR' / '📋 WHAT YOUR LETTER SAYS'`

Fields note (~line 882): same pattern.

Analyze button (~line 958):
```jsx
{documentType === 'medical_bill' ? tr('analyzeBillBtn', '🔍 Analyze This Bill →') : tr('analyzeDenialBtn', '🔍 Analyze My Denial →')}
```

- [ ] **Step 5: Replace analyzing screen strings (~line 967)**

```jsx
<Card title={tr('scanningTitle', '🤖 Scanning Denial...')} subtitle={tr('scanningSubtitle', 'Reading between the lines')}>
```

Scanning messages:
```js
[
  tr('scanMsg1', 'Identifying denial type...'),
  tr('scanMsg2', 'Locating applicable laws...'),
  tr('scanMsg3', 'Finding insurance AI weaknesses...'),
  tr('scanMsg4', 'Building your battle plan...'),
]
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: translate home screen and form to Spanish"
```

---

### Task 4: Replace strings in App.jsx — battle plan + letters + billing + footer

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace confirm card strings (~lines 994–1072)**

```jsx
<Card title={tr('confirmTitle', '📋 Confirm What We Found')} subtitle={tr('confirmSubtitle', 'Fix anything that looks wrong before we draft your letters')}>
```

ConfirmField labels:
- `label="Plan Type"` → `label={tr('labelPlanType', 'Plan Type')}`
- `hint="This determines which laws protect you..."` → `hint={tr('planTypeHint', 'This determines which laws protect you. Please confirm.')}`
- `label="Denial Reason"` → `label={tr('labelDenialReasonConf', 'Denial Reason')}`
- `label="Appeal Level"` → `label={tr('labelAppealLevel', 'Appeal Level')}`
- `label="Appeal Deadline"` → `label={tr('labelAppealDeadline', 'Appeal Deadline')}`
- `label="Insurance Company"` → `label={tr('labelInsurerConf', 'Insurance Company')}`
- `label="Service / Treatment Denied"` → `label={tr('labelServiceDenied', 'Service / Treatment Denied')}`
- `label="State"` → `label={tr('labelState', 'State')}`

Low confidence warning (~line 1069):
```jsx
{tr('lowConfWarning', '⚠ yellow fields had low confidence — please review before continuing.')}
```

- [ ] **Step 2: Replace battle plan strings (~lines 1076–1141)**

```jsx
<Card title={tr('battlePlanTitle', '⚔️ Your Battle Plan')} subtitle={`Win rate on appeal: ${analysisResult.winRate}`}>
```

Section labels:
- `'APPEAL SUCCESS PROBABILITY'` → `{tr('appealSuccessLabel', 'APPEAL SUCCESS PROBABILITY')}`
- `'Timeline:'` prefix → `{tr('timelineLabel', 'Timeline:')} ...`
- `'HOW THEIR AI WORKS AGAINST YOU'` → `{tr('howTheirAI', 'HOW THEIR AI WORKS AGAINST YOU')}`
- `'🔑 MAGIC KEYWORDS (use these in your appeal)'` → `{tr('magicKeywords', '🔑 MAGIC KEYWORDS (use these in your appeal)')}`
- `'⚖️ LAWS PROTECTING YOU'` → `{tr('lawsProtecting', '⚖️ LAWS PROTECTING YOU')}`
- `'📋 ACTION STEPS (do these NOW)'` → `{tr('actionSteps', '📋 ACTION STEPS (do these NOW)')}`
- Draft button: `'✉️ Looks Right — Draft My Appeal →'` → `{tr('draftLetterBtn', '✉️ Looks Right — Draft My Appeal →')}`

- [ ] **Step 3: Replace letter screen strings (~lines 1237–1344)**

```jsx
<Card title={tr('lettersTitle', '✉️ Your Letters')} subtitle={tr('lettersSubtitle', 'Three letters ready to send — tap a tab to switch')}>
```

Generating state:
- `'Writing all three letters at once...'` → `{tr('generatingLetters', 'Writing all three letters at once...')}`
- `'Insurance appeal · Hospital · Doctor'` → `{tr('generatingLettersSub', 'Insurance appeal · Hospital · Doctor')}`

Tabs:
```js
[
  { id: "insurance", label: tr('tabInsurance', '🏛 Insurance Appeal') },
  { id: "hospital", label: tr('tabHospital', '🏥 Hospital') },
  { id: "doctor", label: tr('tabDoctor', '👨‍⚕️ Doctor') },
]
```

Buttons:
- `copied ? "✓ Copied!" : "📋 Copy Letter"` → `copied ? tr('copied', '✓ Copied!') : tr('copyLetter', '📋 Copy Letter')`
- `'🔄 Regenerate All'` → `{tr('regenerateAll', '🔄 Regenerate All')}`
- `'📅 Add Appeal Deadline to Calendar'` → `{tr('addCalendar', '📅 Add Appeal Deadline to Calendar')}`

After-sending section:
- Title: `{tr('afterSendingTitle', '⚠️ AFTER SENDING YOUR LETTERS')}`
- Steps 1–5: replace each hardcoded string with `{tr('afterSending1', '...')}` etc.

Reset button: `'← Start New Appeal'` → `{tr('startNewAppeal', '← Start New Appeal')}`

- [ ] **Step 4: Replace billing letters screen strings (~lines 1145–1234)**

Title: `'✉️ Your Dispute Letters'` → `{tr('disputeLettersTitle', '✉️ Your Dispute Letters')}`
Subtitle: → `{tr('disputeLettersSubtitle', 'Ready to send — review and edit before mailing')}`
Generating: `'Writing your dispute letters...'` → `{tr('generatingBillingLetters', 'Writing your dispute letters...')}`
Tabs: itemized → `{tr('tabItemized', '📄 Itemized Bill Request')}`, biller error → `{tr('tabBillerError', '🚨 Billing Error Dispute')}`
Copy button: → `{tr('copyBillingLetter', '📋 Copy Letter')}`
Regenerate: → `{tr('regenerateBilling', '🔄 Regenerate')}`
Start over: → `{tr('startOver', '← Start Over')}`

- [ ] **Step 5: Replace footer disclaimer (~line 1351)**

```jsx
{tr('footerDisclaimer', 'healthcareadvocate.org — Not legal advice. Consult a healthcare attorney for complex cases.')}
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: translate battle plan, letters, and billing screens to Spanish"
```

---

### Task 5: Update BillReviewScreen.jsx + FactsUsedCard.jsx

**Files:**
- Modify: `src/components/BillReviewScreen.jsx`
- Modify: `src/components/FactsUsedCard.jsx`

- [ ] **Step 1: Update BillReviewScreen.jsx**

Add `lang` to props and import `es`:
```js
import es from '../i18n/es'

export default function BillReviewScreen({ bill, onGenerate, onSwitch, lang = 'en' }) {
  const tr = (key, english) => (lang === 'es' && es[key]) ? es[key] : english
  
  const FLAG_LABELS = {
    missing_code: { icon: '⚠', label: tr('flagMissingCode', 'No billing code'), color: '#ffd700' },
    vague_description: { icon: '⚠', label: tr('flagVague', 'Vague description'), color: '#ffd700' },
    possible_duplicate: { icon: '🚨', label: tr('flagDuplicate', 'Possible duplicate'), color: '#ff6060' },
    biller_error: { icon: '🚨', label: tr('flagBillerError', 'Possible biller error'), color: '#ff6060' },
  }
  // ...
```

Move FLAG_LABELS inside the function so it can use `tr`.

Replace hardcoded strings:
- `'📞 BILLING DEPARTMENT'` → `{tr('billingDept', '📞 BILLING DEPARTMENT')}`
- `'Call the number on your bill...'` → `{tr('callBillingDept', 'Call the number on your bill and ask for the Billing Department.')}`
- `'🚨 BILLING ERROR - THIS MAY NOT BE YOUR RESPONSIBILITY'` → `{tr('billerErrorTitle', '🚨 BILLING ERROR - THIS MAY NOT BE YOUR RESPONSIBILITY')}`
- The biller error explanatory note → `{tr('billerErrorNote', 'If the biller submitted...')}`
- `'📋 WHAT THIS BILL IS FOR'` → `{tr('whatBillIsFor', '📋 WHAT THIS BILL IS FOR')}`
- `'CHARGES'` → `{tr('chargesLabel', 'CHARGES')}`
- `'No billing code'` → `{tr('noBillingCode', 'No billing code')}`
- `'⚠ THIS BILL IS MISSING REQUIRED INFORMATION'` → `{tr('missingInfoTitle', '⚠ THIS BILL IS MISSING REQUIRED INFORMATION')}`
- `'✉️ Generate Dispute Letters →'` → `{tr('generateDisputeLetters', '✉️ Generate Dispute Letters →')}`
- `'Switch to denial letter flow instead'` → `{tr('switchToDenialFlow', 'Switch to denial letter flow instead')}`

- [ ] **Step 2: Update FactsUsedCard.jsx**

```js
import es from '../i18n/es'

export function FactsUsedCard({ citations, lang = 'en' }) {
  const tr = (key, english) => (lang === 'es' && es[key]) ? es[key] : english
  if (!citations || citations.length === 0) return null
  // ...
```

Replace:
- `'🛡️ VERIFIED SOURCES USED'` → `{tr('verifiedSourcesTitle', '🛡️ VERIFIED SOURCES USED')}`
- `'To prevent mistakes, this appeal was written using...'` → `{tr('verifiedSourcesBody', 'To prevent mistakes, this appeal was written using the following official rules:')}`
- `'No private data left your device to look up these rules.'` → `{tr('verifiedSourcesFooter', 'No private data left your device to look up these rules.')}`

- [ ] **Step 3: Test — switch to Spanish, upload a document, verify BillReviewScreen and FactsUsedCard show Spanish text**

- [ ] **Step 4: Commit**

```bash
git add src/components/BillReviewScreen.jsx src/components/FactsUsedCard.jsx
git commit -m "feat: translate BillReviewScreen and FactsUsedCard to Spanish"
```

---

### Task 6: Update claude.js to pass language to AI prompts

**Files:**
- Modify: `src/lib/claude.js`

Context: When lang === 'es', the AI should return the `plain_english` explanation in Spanish. Letters are ALWAYS generated in English — do NOT add language param to letter generation calls. Only `analyzePhoto` and `analyzeMedicalBill` need the language param (they generate the `plain_english` field the user reads).

- [ ] **Step 1: Add language param to analyzePhoto**

```js
export async function analyzePhoto(imageBase64, mediaType, language = 'en') {
  const langNote = language === 'es'
    ? '\n\nIMPORTANT: Write the "plain_english" field in Spanish.'
    : ''
  const data = await callClaude({
    // ... existing body ...
    messages: [
      {
        role: 'user',
        content: [
          fileContent(imageBase64, mediaType),
          { type: 'text', text: PHOTO_PROMPT + langNote },
        ],
      },
    ],
  })
  // ... rest unchanged
}
```

- [ ] **Step 2: Add language param to analyzeMedicalBill**

Same pattern — append `langNote` to `MEDICAL_BILL_PROMPT`.

- [ ] **Step 3: Update App.jsx calls to pass lang**

In `handlePhoto` (~line 343): `analyzePhoto(base64, file.type, lang)`
In `runAnalysis` (~line 364): `analyzeMedicalBill(photoBase64Stored, photoMediaTypeStored, lang)`

- [ ] **Step 4: Commit**

```bash
git add src/lib/claude.js src/App.jsx
git commit -m "feat: pass language to AI prompts for Spanish explanations"
```

---

### Task 7: Add "Leer en Español" letter translation toggle

**Files:**
- Modify: `src/App.jsx`

Context: When lang === 'en', add a "Leer en Español" button under the letter that fetches a Spanish translation on demand. When lang === 'es', letters are in English (correct for submission), so show "Leer en Español" by default. In both cases this is a toggle: EN ↔ ES for reading only — the submitted letter stays English.

- [ ] **Step 1: Add translation state to InsuranceFighter**

After existing state declarations:
```js
const [translatedLetter, setTranslatedLetter] = useState('')
const [translatingLetter, setTranslatingLetter] = useState(false)
const [showLetterTranslation, setShowLetterTranslation] = useState(false)
const [translatedBillingLetter, setTranslatedBillingLetter] = useState('')
const [translatingBillingLetter, setTranslatingBillingLetter] = useState(false)
const [showBillingTranslation, setShowBillingTranslation] = useState(false)
```

Reset these in the `reset()` function:
```js
setTranslatedLetter('')
setTranslatingLetter(false)
setShowLetterTranslation(false)
setTranslatedBillingLetter('')
setTranslatingBillingLetter(false)
setShowBillingTranslation(false)
```

- [ ] **Step 2: Add translateLetter function**

```js
const translateLetter = async (text, onDone, setTranslating) => {
  setTranslating(true)
  try {
    const result = await callClaude({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Translate this appeal letter to Spanish. Preserve all names, dates, claim numbers, dollar amounts, and legal citations exactly as written. Write only the translated letter — no preamble.\n\n${text}`,
      }],
    })
    onDone(result.content.find(b => b.type === 'text')?.text || '')
  } catch {
    onDone('[Translation error — please try again]')
  }
  setTranslating(false)
}
```

- [ ] **Step 3: Add toggle button + conditional display to denial letter screen**

In the letter screen, after the `<div>` containing the letter `<pre>` (around line 1283), add below the letter body and above the action buttons:

```jsx
{/* Translation toggle */}
<div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
  <button
    onClick={async () => {
      if (!showLetterTranslation) {
        if (!translatedLetter) {
          await translateLetter(
            letters[activeTab],
            setTranslatedLetter,
            setTranslatingLetter
          )
        }
        setShowLetterTranslation(true)
      } else {
        setShowLetterTranslation(false)
      }
    }}
    style={{
      background: 'transparent',
      border: '1px solid rgba(0,229,160,0.25)',
      borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
      color: 'rgba(0,229,160,0.6)', fontSize: 12, fontFamily: 'monospace',
    }}
  >
    {translatingLetter
      ? tr('translatingLetter', 'Translating...')
      : showLetterTranslation
        ? tr('readInEnglish', '🌐 Read in English')
        : tr('readInSpanish', '🌐 Leer en Español')}
  </button>
</div>
```

Also, when `showLetterTranslation` is true, show the translated letter instead of the English one. Find the `<pre>` containing `{letterDone ? letters[activeTab] : <TypewriterText .../>}` and wrap:

```jsx
<pre ...>
  {showLetterTranslation
    ? translatedLetter
    : letterDone
      ? letters[activeTab]
      : <TypewriterText key={activeTab} text={letters[activeTab]} speed={8} onDone={() => setLetterDone(true)} />}
</pre>
```

Reset translation when tab changes — update the tab `onClick`:
```jsx
onClick={() => { setActiveTab(tab.id); setLetterDone(false); setTranslatedLetter(''); setShowLetterTranslation(false); }}
```

- [ ] **Step 4: Add same toggle to billing letters screen**

Same pattern. In the bill letters screen, after the `<pre>` block (~line 1201), add a translation button that calls `translateLetter` with `billingLetters[activeBillingTab]`.

Reset translation on billing tab change:
```jsx
onClick={() => { setActiveBillingTab('itemized_request'); setTranslatedBillingLetter(''); setShowBillingTranslation(false); }}
```

- [ ] **Step 5: Test the full flow**
1. Switch to Spanish → upload a denial letter → verify explanation is in Spanish
2. View generated letter (English) → click "Leer en Español" → verify Spanish translation appears
3. Click "Read in English" → verify English letter returns
4. Switch tabs → verify translation clears (fresh translation per tab)
5. Switch to English UI → "Leer en Español" button still present and works

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Leer en Español translation toggle for appeal and dispute letters"
```

---

## After all tasks

Run `npm run build` and verify clean build. Then deploy dist/ to server.
