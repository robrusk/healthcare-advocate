// =============================================================================
// App.jsx — Healthcare Advocate main component
// healthcareadvocate.org | office@healthcareadvocate.org
// =============================================================================
//
// USER FLOW
// ─────────
// Home screen (two cards)
//   → User taps "Fight a Denial" or "Review a Bill" → sets documentType
//   → File picker opens → handlePhoto() runs
//     → analyzePhoto() — Haiku model, extracts plain-English summary + basic fields
//   → Form appears with summary + fields
//   → User clicks Analyze
//     → runAnalysis() branches:
//         [denial_letter] → analyzeDenial() → confirmation card → battle plan → generateLetter()
//         [medical_bill]  → analyzeMedicalBill() → BillReviewScreen → generateBillingLetters()
//
// KEY STATE
// ─────────
//   step              — current screen: upload | analyze | strategy | letter |
//                                       bill_review | bill_letters
//   documentType      — 'denial_letter' | 'medical_bill' | null (null = AI detects)
//   photoSummary      — plain-English explanation shown after photo upload
//   confirmedExtraction — user-reviewed extraction data (plan type, deadline, etc.)
//   billExtraction    — extracted medical bill data (line items, flags, biller error)
//
// TWO-PASS ARCHITECTURE (denial letters)
// ───────────────────────────────────────
// Pass 1: analyzeDenial() — Haiku extracts structured JSON, never writes letters
// Pass 2: User confirms plan type, denial reason, deadline on the confirmation card
// Pass 3: generateLetter() — Opus writes letters using confirmed data + planRoutes.js
//         legal framework + src/templates/ vetted structure + src/library/ verified facts
//
// WHY THIS MATTERS: Citing ERISA on a Medicare denial gets the appeal dismissed.
// planRoutes.js enforces the correct legal framework per plan type. If plan_type
// is 'unclear', letter generation is blocked until the user clarifies.
//
// CLOUDFLARE WORKER
// ─────────────────
// All Claude API calls go through a Worker proxy (WORKER_URL below).
// The Anthropic API key lives in the Worker — never in this bundle.
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { analyzePhoto, analyzeDenial, analyzeMedicalBill, fileToBase64 } from "./lib/claude";
import { buildLegalFramework, loadTemplate } from "./lib/planRoutes";
import { lookupVerifiedFacts } from "./library/index";
import { FactsUsedCard } from "./components/FactsUsedCard";
import BillReviewScreen from "./components/BillReviewScreen";
import { downloadAppealReminder } from "./lib/calendar";

const WORKER_URL = 'https://icy-silence-e717.rob-3ea.workers.dev/';

async function callClaude(body) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Worker error ${res.status}: ${await res.text()}`);
  return res.json();
}

const DENY_REASONS = [
  { id: "not_medically_necessary", label: "Not Medically Necessary" },
  { id: "experimental", label: "Experimental / Investigational" },
  { id: "prior_auth", label: "Prior Authorization Required / Missing" },
  { id: "out_of_network", label: "Out-of-Network Provider" },
  { id: "coding_error", label: "Billing / Coding Error" },
  { id: "duplicate_claim", label: "Duplicate Claim" },
  { id: "benefit_limit", label: "Benefit Limit Exceeded" },
  { id: "not_covered", label: "Not a Covered Benefit" },
  { id: "timely_filing", label: "Timely Filing Limit Exceeded" },
  { id: "other", label: "Other / Unknown" },
];

const STEPS = [
  { id: "upload", label: "Scan Denial", icon: "📄" },
  { id: "analyze", label: "AI Analysis", icon: "🔍" },
  { id: "strategy", label: "Battle Plan", icon: "⚔️" },
  { id: "letter", label: "Appeal Letter", icon: "✉️" },
];

const INSURANCE_KEYWORDS = {
  not_medically_necessary: {
    powerWords: ["medical necessity", "standard of care", "clinical guidelines", "evidence-based", "AMA guidelines", "peer-reviewed literature", "functional impairment", "significant morbidity", "physician-ordered", "clinically indicated"],
    laws: ["ERISA § 502(a)", "29 CFR 2560.503-1", "ACA Internal Appeals", "State insurance code § (varies)"],
    strategy: "Their AI flagged this as 'elective.' We override by flooding the letter with clinical necessity language and citing specific medical guidelines their system is trained to respect.",
    timeline: "30–60 days internal appeal",
    winRate: "67%",
    tactics: [
      "Get a Letter of Medical Necessity (LMN) from your doctor — very specific language",
      "Cite the exact CPT/ICD-10 codes and match them to the denial reason",
      "Request the insurer's Clinical Coverage Policy used to deny you",
      "Include peer-reviewed studies (PubMed links work)",
      "Ask for a peer-to-peer review between your doctor and their Medical Director",
    ],
  },
  experimental: {
    powerWords: ["FDA approved", "covered by Medicare", "widely accepted", "standard treatment protocol", "clinical consensus", "not investigational", "established medical practice", "National Coverage Determination"],
    laws: ["ACA § 2719", "ERISA § 503", "Medicare LCD/NCD coverage"],
    strategy: "Insurance AI systems cross-reference FDA approval status and Medicare coverage databases. If Medicare covers it, private insurers have a very hard time calling it experimental.",
    timeline: "45–60 days",
    winRate: "58%",
    tactics: [
      "Find the Medicare National Coverage Determination (NCD) or Local Coverage Determination (LCD) for this treatment",
      "Pull FDA approval documentation",
      "Get specialty society guidelines (oncology, cardiology, etc.)",
      "Document how long this treatment has been used in clinical practice",
      "Find 3+ peer-reviewed studies from major medical journals",
    ],
  },
  prior_auth: {
    powerWords: ["retroactive authorization", "urgent/emergent circumstances", "medical emergency", "timely access to care", "continuity of care", "good faith effort", "provider-initiated"],
    laws: ["ACA Grandfathered Plan Rules", "ERISA § 503", "State prompt pay laws", "Emergency Medical Treatment Act (EMTALA)"],
    strategy: "Prior auth denials have two angles: (1) prove auth wasn't required or was obtained, or (2) argue the auth requirement itself violated timely access to care laws. Emergency situations auto-override most auth requirements.",
    timeline: "Expedited: 72 hours if urgent",
    winRate: "71%",
    tactics: [
      "Request ALL prior authorization records and communications",
      "If emergency: cite EMTALA and state emergency care laws",
      "Get documentation that your provider submitted auth (fax confirmations, portal screenshots)",
      "Argue that requiring auth for emergency care violates federal law",
      "Request expedited review if condition is still active",
    ],
  },
  out_of_network: {
    powerWords: ["no in-network alternative", "continuity of care", "specialist unavailable", "network adequacy", "balance billing prohibition", "No Surprises Act", "nearest available provider"],
    laws: ["No Surprises Act (2022)", "ACA Network Adequacy Rules", "29 CFR 2590.715-2719A", "State balance billing laws"],
    strategy: "The No Surprises Act (2022) is your BIGGEST weapon. It eliminated balance billing for emergency out-of-network care. For non-emergency: attack network adequacy — if no in-network provider is reasonably available, they must cover out-of-network at in-network rates.",
    timeline: "30 days standard",
    winRate: "74%",
    tactics: [
      "File a No Surprises Act complaint with CMS if this was emergency or surprise billing",
      "Request the insurer's network adequacy documentation for your specialty/geography",
      "Document your attempts to find an in-network provider (dates, names, reasons none worked)",
      "Get a continuity of care letter from your doctor if mid-treatment",
      "Check your state's independent dispute resolution process",
    ],
  },
  coding_error: {
    powerWords: ["billing correction", "amended claim", "modifier required", "correct code pairing", "not a duplicate", "distinct procedure", "CMS coding guidelines", "NCCI edits"],
    laws: ["False Claims Act (reverse — you're correcting)", "CMS Billing Guidelines", "AMA CPT Guidelines"],
    strategy: "Coding errors are the easiest wins. The insurance AI auto-rejected based on code mismatch or bundling rules. A simple corrected claim with the right modifier often gets paid within 2 weeks.",
    timeline: "2–4 weeks with corrected claim",
    winRate: "89%",
    tactics: [
      "Get the Explanation of Benefits (EOB) and identify the exact denial code (CO-4, CO-11, CO-97, etc.)",
      "Ask your provider's billing department to review and resubmit with correct modifiers",
      "Reference the specific CMS or AMA CPT coding guideline that supports your code",
      "If bundled incorrectly, cite the NCCI (National Correct Coding Initiative) edit that was misapplied",
      "Request unbundling if procedures were truly distinct and separate",
    ],
  },
  duplicate_claim: {
    powerWords: ["not a duplicate", "distinct date of service", "separate episode of care", "different diagnosis", "corrected claim", "claim reference number"],
    laws: ["CMS Claim Adjustment Reason Code (CARC) 18", "State duplicate claim definitions"],
    strategy: "Duplicate claim denials are often false positives from the insurer's AI matching system. Prove the service was distinct — different date, different procedure, or a corrected resubmission — and the denial collapses.",
    timeline: "2–3 weeks",
    winRate: "82%",
    tactics: [
      "Request the claim number of the 'original' claim they say this duplicates",
      "Compare dates of service, procedure codes, and diagnosis codes to prove they are different",
      "If it's a corrected claim resubmission, use form box 22 (Resubmission Code) properly",
      "Get provider records confirming the service was actually rendered on the disputed date",
      "Submit a detailed side-by-side comparison of both claims showing they are distinct",
    ],
  },
  benefit_limit: {
    powerWords: ["mental health parity", "medical necessity exception", "chronic condition", "not arbitrary limitation", "comparable medical benefit", "non-quantitative treatment limitation"],
    laws: ["Mental Health Parity and Addiction Equity Act (MHPAEA)", "ACA § 2711", "ERISA § 712", "29 CFR 2590.712"],
    strategy: "Benefit limits are frequently illegal, especially for mental health, substance use, and chronic conditions. The Mental Health Parity Act is extremely powerful and often overlooked by insurance AI systems.",
    timeline: "60 days",
    winRate: "61%",
    tactics: [
      "Compare your mental health/substance use benefit limits to comparable medical/surgical benefits",
      "Request the insurer's Non-Quantitative Treatment Limitation (NQTL) analysis",
      "File a MHPAEA complaint with your state insurance commissioner",
      "Document medical necessity for continued treatment beyond the limit",
      "Reference the ACA's prohibition on lifetime/annual limits for essential health benefits",
    ],
  },
  not_covered: {
    powerWords: ["essential health benefit", "ambiguous exclusion", "reasonable interpretation", "contra proferentem", "plan document conflict", "summary plan description", "undefined term"],
    laws: ["ACA Essential Health Benefits (§ 1302)", "ERISA § 502(a)", "Contra proferentem doctrine", "State mandated benefit laws"],
    strategy: "When insurers say 'not covered,' the first move is to challenge whether the exclusion is clearly defined. Courts apply 'contra proferentem' — ambiguous insurance language is interpreted AGAINST the insurer. Also check ACA essential health benefit requirements.",
    timeline: "60–90 days (may need external review)",
    winRate: "44%",
    tactics: [
      "Get your complete Summary Plan Description (SPD) — you're legally entitled to it free",
      "Find the exact exclusion language and look for ambiguity or undefined terms",
      "Check if this is an ACA Essential Health Benefit (preventive, mental health, maternity, etc.)",
      "Check your state's mandated benefit laws — states can require coverage beyond ACA",
      "If denied again internally, request External Independent Review immediately",
    ],
  },
  timely_filing: {
    powerWords: ["timely filing exception", "insurer error", "provider delay", "eligibility verification delay", "proof of timely submission", "coordination of benefits delay", "good cause exception"],
    laws: ["29 CFR 2560.503-1(b)", "State prompt pay laws", "Plan document timely filing provisions"],
    strategy: "Timely filing denials can be beaten if you can show it wasn't your fault — insurer eligibility issues, provider error, or coordination of benefits confusion all qualify as exceptions. Get documented proof the claim was submitted.",
    timeline: "30 days",
    winRate: "52%",
    tactics: [
      "Get proof of original claim submission from your provider (clearinghouse reports, fax confirmations)",
      "Document any eligibility or coordination of benefits issues that caused delay",
      "Check if the insurer's own processing delays contributed to the timing issue",
      "If provider error: get a letter from provider accepting responsibility and requesting exception",
      "Some states prohibit timely filing denials when the patient had no control over the delay",
    ],
  },
  other: {
    powerWords: ["internal appeal rights", "adverse benefit determination", "full and fair review", "claim file copy", "specific reason for denial", "clinical criteria used"],
    laws: ["ERISA § 503", "29 CFR 2560.503-1", "ACA Internal Appeals", "ACA External Review"],
    strategy: "Start by demanding the complete claim file and the SPECIFIC reason for denial with the exact clinical criteria used. ERISA and ACA require them to give you this. Without knowing the real reason, you can't fight effectively.",
    timeline: "Varies",
    winRate: "55% on appeal",
    tactics: [
      "Request your complete claim file in writing (they must provide it within 30 days under ERISA)",
      "Demand the specific clinical criteria or plan language used to deny your claim",
      "Request the name and credentials of the person who reviewed your claim",
      "File an appeal asserting your right to a 'full and fair review' under ERISA § 503",
      "If all else fails, request External Independent Review — this is your ace card",
    ],
  },
};

function TypewriterText({ text, speed = 18, onDone }) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);
  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    if (!text) return;
    const iv = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        clearInterval(iv);
        if (onDone) onDone();
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text]);
  return <span>{displayed}<span className="blink">|</span></span>;
}

function ProgressBar({ value, color = "#00e5a0" }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, height: 8, overflow: "hidden", margin: "4px 0" }}>
      <div style={{ width: `${value}%`, background: color, height: "100%", borderRadius: 8, transition: "width 1s ease", boxShadow: `0 0 8px ${color}` }} />
    </div>
  );
}

const PLAN_TYPE_LABELS = {
  employer_erisa: "Employer-sponsored (ERISA)",
  aca_marketplace: "ACA Marketplace / Exchange",
  medicare_advantage: "Medicare Advantage (Part C)",
  original_medicare: "Traditional Medicare (Parts A & B)",
  medicaid: "Medicaid",
  fehb: "Federal Employee (FEHB)",
  unclear: "Unknown — please confirm",
};

const DENIAL_REASON_LABELS = {
  medical_necessity: "Not Medically Necessary",
  experimental: "Experimental / Investigational",
  out_of_network: "Out-of-Network Provider",
  not_covered: "Not a Covered Benefit",
  prior_auth_missing: "Prior Authorization Missing",
  step_therapy: "Step Therapy Required",
  other: "Other / Unknown",
};

const APPEAL_LEVEL_LABELS = {
  first_internal: "First Internal Appeal",
  second_internal: "Second Internal Appeal",
  external_review: "External Independent Review",
  unclear: "Unknown — please confirm",
};

export default function InsuranceFighter() {
  const [step, setStep] = useState("upload");
  const [denialText, setDenialText] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterRelationship, setSubmitterRelationship] = useState("patient");
  const [submitterPhone, setSubmitterPhone] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [patientName, setPatientName] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [treatment, setTreatment] = useState("");
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoMediaType, setPhotoMediaType] = useState(null);
  const [photoReading, setPhotoReading] = useState(false);
  const [photoSummary, setPhotoSummary] = useState("");
  const [denialExtraction, setDenialExtraction] = useState(null);
  const [confirmedExtraction, setConfirmedExtraction] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [letters, setLetters] = useState({ insurance: "", hospital: "", doctor: "" });
  const [activeTab, setActiveTab] = useState("insurance");
  const [generating, setGenerating] = useState(false);
  const [visibleCitations, setVisibleCitations] = useState([]);
  const [copied, setCopied] = useState(false);
  const [letterDone, setLetterDone] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  const [documentType, setDocumentType] = useState(null);
  const [billExtraction, setBillExtraction] = useState(null);
  const [billingLetters, setBillingLetters] = useState({ itemized_request: '', biller_error_dispute: '' });
  const [activeBillingTab, setActiveBillingTab] = useState('itemized_request');
  const [generatingBilling, setGeneratingBilling] = useState(false);
  const [photoBase64Stored, setPhotoBase64Stored] = useState(null);
  const [photoMediaTypeStored, setPhotoMediaTypeStored] = useState(null);

  useEffect(() => {
    setTimeout(() => setAnimateIn(true), 100);
  }, []);

  const currentSteps = documentType === 'medical_bill'
    ? [
        { id: "upload", label: "Scan Bill", icon: "📄" },
        { id: "analyze", label: "AI Analysis", icon: "🔍" },
        { id: "bill_review", label: "Bill Review", icon: "🧾" },
        { id: "bill_letters", label: "Dispute Letters", icon: "✉️" },
      ]
    : STEPS;
  const stepIndex = currentSteps.findIndex((s) => s.id === step);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoReading(true);
    setPhotoSummary("");
    try {
      const base64 = await fileToBase64(file);
      setPhotoBase64(base64);
      setPhotoMediaType(file.type);
      setPhotoBase64Stored(base64);
      setPhotoMediaTypeStored(file.type);
      const result = await analyzePhoto(base64, file.type);
      setDocumentType(result.document_type || 'denial_letter');
      setPhotoSummary(result.plain_english);
      if (result.denial_reason) setDenialReason(result.denial_reason);
      if (result.patient_name) setPatientName(result.patient_name);
      if (result.claim_number) setClaimNumber(result.claim_number);
      if (result.insurer_name) setInsurerName(result.insurer_name);
      if (result.treatment) setTreatment(result.treatment);
    } catch (err) {
      console.error("Photo analysis error:", err);
      setPhotoSummary(`Error reading letter: ${err?.message || err}. Please fill in the fields below manually.`);
    }
    setPhotoReading(false);
  };

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

  const generateBillingLetters = async () => {
    if (!billExtraction) return;
    setGeneratingBilling(true);
    setStep("bill_letters");
    setActiveBillingTab("itemized_request");

    const signerName = submitterName || "[YOUR NAME]";
    const signerContact = [submitterPhone, submitterEmail].filter(Boolean).join(" | ") || "[YOUR PHONE / EMAIL]";
    const providerName = billExtraction.provider_name || "[PROVIDER NAME]";
    const accountNumber = billExtraction.account_number || "[ACCOUNT NUMBER]";

    const flaggedItems = (billExtraction.line_items || [])
      .filter(item => (item.flags || []).length > 0)
      .map(item => `- ${item.description} (${item.amount || 'amount unclear'}): ${(item.flags || []).join(', ')}`)
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
      const letterDraft = { itemized_request: '', biller_error_dispute: '' };

      const calls = [
        callClaude({ model: "claude-opus-4-7", max_tokens: 800, messages: [{ role: "user", content: itemizedPrompt }] })
          .then(r => { letterDraft.itemized_request = r.content.find(b => b.type === "text")?.text || "" }),
      ];

      if (billExtraction.biller_error_detected) {
        calls.push(
          callClaude({ model: "claude-opus-4-7", max_tokens: 800, messages: [{ role: "user", content: billerErrorPrompt }] })
            .then(r => { letterDraft.biller_error_dispute = r.content.find(b => b.type === "text")?.text || "" })
        );
      }

      await Promise.all(calls);
      setBillingLetters(letterDraft);
    } catch (e) {
      setBillingLetters({ itemized_request: "Error generating letter. Please try again.", biller_error_dispute: "" });
    }
    setGeneratingBilling(false);
  };

  const generateLetter = async () => {
    // Block generation if plan type is unconfirmed — wrong framework = dismissed appeal
    const planType = confirmedExtraction?.plan_type || "unclear";
    if (planType === "unclear") {
      alert("Please confirm the Plan Type before generating your appeal. This determines which laws protect you.");
      return;
    }

    setGenerating(true);
    setStep("letter");
    setLetterDone(false);
    setActiveTab("insurance");
    const info = INSURANCE_KEYWORDS[denialReason];
    const reasonLabel = DENY_REASONS.find((r) => r.id === denialReason)?.label;

    // Use confirmed extraction data when available, fall back to form fields
    const resolvedInsurer = confirmedExtraction?.insurer_name || insurerName || "[INSURANCE COMPANY]";
    const resolvedService = confirmedExtraction?.service_denied || treatment || "[TREATMENT]";
    const resolvedDeadline = confirmedExtraction?.appeal_deadline || null;
    const resolvedState = confirmedExtraction?.state || null;
    const resolvedDenialReason = confirmedExtraction?.denial_reason
      ? DENIAL_REASON_LABELS[confirmedExtraction.denial_reason]
      : reasonLabel;

    // Build the legal framework from the routing table
    const legalFramework = buildLegalFramework(planType);

    // Load the vetted template for this plan/denial combination (may be null for stubs)
    const denialReasonKey = confirmedExtraction?.denial_reason || "medical_necessity";
    const template = loadTemplate(planType, denialReasonKey);

    const { silentContext, visibleCitations: citations } = lookupVerifiedFacts({
      plan_type: planType,
      denial_reason: confirmedExtraction?.denial_reason || "medical_necessity",
      state: confirmedExtraction?.state || null,
    });
    setVisibleCitations(citations);

    const isPatient = submitterRelationship === "patient";
    const signerName = submitterName || "[YOUR NAME]";
    const signerContact = [submitterPhone, submitterEmail].filter(Boolean).join(" | ") || "[YOUR PHONE / EMAIL]";
    const relationshipLabel = {
      patient: "the patient",
      spouse: "the patient's spouse",
      adult_child: "the patient's adult child",
      family: "a family member of the patient",
      advocate: "the patient's authorized advocate",
    }[submitterRelationship] || "the patient's representative";

    const signerLine = isPatient
      ? "The letter is written in first person by the patient themselves."
      : `The letter is written by ${signerName}, who is ${relationshipLabel}. Open with a sentence identifying who is writing and their relationship to the patient.`;

    const closing = `Close with the signer's name (${signerName}) and contact info (${signerContact}). Include a signature line.`;

    const context = `Patient: ${patientName || "[PATIENT NAME]"}
Claim Number: ${claimNumber || "[CLAIM NUMBER]"}
Insurance Company: ${resolvedInsurer}
Treatment/Service: ${resolvedService}
Denial Reason: ${resolvedDenialReason}${resolvedDeadline ? `\nAppeal Deadline: ${resolvedDeadline}` : ""}${resolvedState ? `\nState: ${resolvedState}` : ""}
Written by: ${signerName} (${relationshipLabel})`;

    const templateSection = template
      ? `VETTED APPEAL TEMPLATE — adapt this structure. Fill in placeholders with the case facts above. Do not deviate from the legal framework it establishes.\n\n${template}`
      : `No specific template available for this plan type. Use the legal framework above as your sole source of citations.`;

    const insurancePrompt = `You are an expert patient advocate and healthcare attorney. Generate a powerful, legally precise insurance appeal letter.

${context}

${legalFramework}

${templateSection}

${silentContext ? `VERIFIED FACTS — answer ONLY from these documents, not from training memory. If a needed fact is not here, write [VERIFY: ___] rather than guessing:\n\n${silentContext}\n` : ""}
INSTRUCTIONS:
1. Use ONLY the legal citations from the framework above — never introduce outside citations
2. Replace all {{placeholder}} tokens with the actual case facts provided
3. Use these clinical keywords throughout: ${info.powerWords.slice(0, 6).join(", ")}
4. ${signerLine}
5. ${closing}
6. Assertive tone — this is a legal demand, not a polite request
7. If appeal deadline is provided, reference it explicitly
8. Under 600 words. Start with the date line. Write ONLY the letter.`;

    const hospitalPrompt = `You are a patient advocate. Write a firm, professional letter to the hospital on behalf of a patient whose insurance claim was denied.

${context}

PURPOSE: Request the hospital's patient advocacy department to:
1. Provide a complete itemized bill and all medical records related to this claim
2. Place a hold on any collections activity while the insurance appeal is pending
3. Connect the patient with the hospital's financial assistance and patient advocate programs
4. Cooperate fully with the insurance appeal process

INSTRUCTIONS:
- ${signerLine}
- ${closing}
- Professional but assertive tone
- Under 400 words. Start with the date line. Write ONLY the letter.`;

    const doctorPrompt = `You are a patient advocate. Write a letter to the treating physician asking them to support an insurance appeal.

${context}

PURPOSE: Ask the doctor to:
1. Write a Letter of Medical Necessity using specific clinical language
2. Use these exact keywords that will trigger human review: ${info.powerWords.slice(0, 4).join(", ")}
3. Reference the specific denial reason (${reasonLabel}) and directly counter it
4. Request a peer-to-peer review call with the insurance company's Medical Director
5. Provide any additional clinical documentation that supports the appeal

INSTRUCTIONS:
- ${signerLine}
- ${closing}
- Respectful, collegial tone — this is a request, not a demand
- Under 400 words. Start with the date line. Write ONLY the letter.`;

    const call = (prompt) => callClaude({
      model: "claude-opus-4-7",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }).then((r) => r.content.find((b) => b.type === "text")?.text || "");

    try {
      const [insurance, hospital, doctor] = await Promise.all([
        call(insurancePrompt),
        call(hospitalPrompt),
        call(doctorPrompt),
      ]);
      setLetters({ insurance, hospital, doctor });
    } catch (e) {
      const err = "Error generating letter. Please try again.";
      setLetters({ insurance: err, hospital: err, doctor: err });
    }
    setGenerating(false);
  };

  const copyLetter = () => {
    navigator.clipboard.writeText(letters[activeTab] || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setStep("upload");
    setDenialText("");
    setDenialReason("");
    setPatientName("");
    setClaimNumber("");
    setInsurerName("");
    setTreatment("");
    setAnalysisResult(null);
    setLetters({ insurance: "", hospital: "", doctor: "" });
    setActiveTab("insurance");
    setGenerating(false);
    setVisibleCitations([]);
    setLetterDone(false);
    setPhotoSummary("");
    setPhotoReading(false);
    setPhotoBase64(null);
    setPhotoMediaType(null);
    setDenialExtraction(null);
    setConfirmedExtraction(null);
    setSubmitterName("");
    setSubmitterRelationship("patient");
    setSubmitterPhone("");
    setSubmitterEmail("");
    setDocumentType(null);
    setBillExtraction(null);
    setBillingLetters({ itemized_request: '', biller_error_dispute: '' });
    setActiveBillingTab('itemized_request');
    setGeneratingBilling(false);
    setPhotoBase64Stored(null);
    setPhotoMediaTypeStored(null);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0e1a 0%, #0d1526 40%, #0a1a12 100%)",
      fontFamily: "'Georgia', serif",
      color: "#e8f4f0",
      padding: "0",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: "linear-gradient(rgba(0,229,160,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,160,0.04) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,229,160,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,60,60,0.05) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>

        <div style={{ textAlign: "center", padding: "32px 0 24px", opacity: animateIn ? 1 : 0, transform: animateIn ? "none" : "translateY(-20px)", transition: "all 0.8s ease" }}>
          <div style={{ fontSize: 26, letterSpacing: 4, color: "#00e5a0", textTransform: "uppercase", marginBottom: 12, fontFamily: "monospace" }}>
            🛡️ healthcareadvocate.org
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.2, letterSpacing: -0.5 }}>
            We're on your side.
          </h1>
          <p style={{ color: "rgba(232,244,240,0.55)", fontSize: 14, margin: 0, fontFamily: "monospace", letterSpacing: 0.5 }}>
            Free help fighting insurance denials and surprise medical bills.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: 32, opacity: (animateIn && (step !== 'upload' || photoSummary || photoReading)) ? 1 : 0, transition: "opacity 1s ease 0.3s", pointerEvents: (step === 'upload' && !photoSummary && !photoReading) ? 'none' : 'auto' }}>
          {currentSteps.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: i <= stepIndex ? 1 : 0.3, transition: "opacity 0.4s" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: i === stepIndex ? "#00e5a0" : i < stepIndex ? "rgba(0,229,160,0.2)" : "rgba(255,255,255,0.05)",
                  border: `2px solid ${i <= stepIndex ? "#00e5a0" : "rgba(255,255,255,0.1)"}`,
                  fontSize: 16, transition: "all 0.4s",
                  boxShadow: i === stepIndex ? "0 0 20px rgba(0,229,160,0.4)" : "none",
                }}>
                  {s.icon}
                </div>
                <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", color: i === stepIndex ? "#00e5a0" : "rgba(255,255,255,0.4)" }}>{s.label}</span>
              </div>
              {i < currentSteps.length - 1 && (
                <div style={{ width: 32, height: 2, background: i < stepIndex ? "#00e5a0" : "rgba(255,255,255,0.1)", margin: "0 4px", marginBottom: 24, transition: "background 0.4s" }} />
              )}
            </div>
          ))}
        </div>

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
                    justifyContent: "space-between",
                  }}>
                    <div style={{ fontSize: 22, textAlign: "center" }}>⚔️</div>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: "#ff6060", margin: 0, textAlign: "center", fontFamily: "Georgia, serif" }}>
                      Fight a Denial
                    </h2>
                    <p style={{ fontSize: 13, color: "rgba(232,244,240,0.7)", lineHeight: 1.5, margin: 0, textAlign: "center", fontFamily: "Georgia, serif" }}>
                      Insurance denied your claim?<br/>You have a deadline.<br/>Let's fight back.
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
                    justifyContent: "space-between",
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

                {/* Fallback link — uses label to ensure iOS Safari file picker opens reliably */}
                <p style={{ textAlign: "center", margin: "4px 0 0" }}>
                  <label
                    htmlFor="unified-file-input"
                    onClick={() => setDocumentType(null)}
                    style={{
                      cursor: "pointer",
                      color: "rgba(232,244,240,0.35)", fontSize: 12,
                      fontFamily: "monospace", textDecoration: "underline",
                    }}
                  >
                    Not sure what you have? Tap here and we'll figure it out.
                  </label>
                </p>

                {/* Why This Exists */}
                <div style={{
                  marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)",
                  paddingTop: 20,
                }}>
                  <div style={{ fontSize: 12, letterSpacing: 2, color: "rgba(232,244,240,0.35)", fontFamily: "monospace", marginBottom: 12 }}>
                    📖 WHY THIS EXISTS
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.8, color: "rgba(232,244,240,0.55)", fontFamily: "Georgia, serif", margin: "0 0 12px" }}>
                    This site was built by a caregiver who watched his parents — and too many other families — get buried under denial letters and confusing medical bills they didn't have the time, energy, or expertise to fight.
                  </p>
                  <p style={{ fontSize: 13, lineHeight: 1.8, color: "rgba(232,244,240,0.55)", fontFamily: "Georgia, serif", margin: "0 0 12px" }}>
                    The healthcare system bets on you giving up. Most people do. The success rate when patients actually appeal denials is around 50% — but only about 1% of denials ever get appealed.
                  </p>
                  <p style={{ fontSize: 13, lineHeight: 1.8, color: "rgba(232,244,240,0.55)", fontFamily: "Georgia, serif", margin: "0 0 12px" }}>
                    This tool exists to close that gap. It's free, run as a volunteer project, not a business. No ads. No upsells. No subscriptions. If it helps you, share it with someone else who needs it.
                  </p>
                  <p style={{ fontSize: 13, lineHeight: 1.8, color: "rgba(232,244,240,0.4)", fontFamily: "Georgia, serif", fontStyle: "italic", margin: 0 }}>
                    Built by a real person who's been there. Not legal advice — but a real place to start.
                  </p>
                </div>
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

        {step === "analyze" && analyzing && (
          <Card title="🤖 Scanning Denial..." subtitle="Reading between the lines">
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 24, animation: "spin 2s linear infinite" }}>⚙️</div>
              {["Identifying denial type...", "Locating applicable laws...", "Finding insurance AI weaknesses...", "Building your battle plan..."].map((msg, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00e5a0", animation: `pulse ${0.5 + i * 0.3}s ease infinite alternate` }} />
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(232,244,240,0.7)" }}>{msg}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {step === "bill_review" && billExtraction && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
            <BillReviewScreen
              bill={billExtraction}
              onGenerate={generateBillingLetters}
              onSwitch={() => { setDocumentType('denial_letter'); setStep('upload'); }}
            />
          </div>
        )}

        {step === "strategy" && analysisResult && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>

            {/* Editable confirmation card */}
            {confirmedExtraction && (
              <Card title="📋 Confirm What We Found" subtitle="Fix anything that looks wrong before we draft your letters">

                {/* Plan Type — most critical field */}
                <ConfirmField
                  icon="🏥" label="Plan Type" critical
                  conf={denialExtraction?.confidence?.plan_type || "low"}
                  hint="This determines which laws protect you. Please confirm."
                >
                  <select value={confirmedExtraction.plan_type || "unclear"}
                    onChange={(e) => setConfirmedExtraction({ ...confirmedExtraction, plan_type: e.target.value })}
                    style={selectStyle}>
                    {Object.entries(PLAN_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </ConfirmField>

                {/* Denial Reason */}
                <ConfirmField icon="⚖️" label="Denial Reason" conf={denialExtraction?.confidence?.denial_reason || "low"}>
                  <select value={confirmedExtraction.denial_reason || "other"}
                    onChange={(e) => setConfirmedExtraction({ ...confirmedExtraction, denial_reason: e.target.value })}
                    style={selectStyle}>
                    {Object.entries(DENIAL_REASON_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </ConfirmField>

                {/* Appeal Level */}
                <ConfirmField icon="🎯" label="Appeal Level" conf={denialExtraction?.confidence?.appeal_level || "high"}>
                  <select value={confirmedExtraction.appeal_level || "unclear"}
                    onChange={(e) => setConfirmedExtraction({ ...confirmedExtraction, appeal_level: e.target.value })}
                    style={selectStyle}>
                    {Object.entries(APPEAL_LEVEL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </ConfirmField>

                {/* Appeal Deadline */}
                <ConfirmField icon="📅" label="Appeal Deadline" conf={denialExtraction?.confidence?.appeal_deadline || "low"}>
                  <input type="date" value={confirmedExtraction.appeal_deadline || ""}
                    onChange={(e) => setConfirmedExtraction({ ...confirmedExtraction, appeal_deadline: e.target.value })}
                    style={inputStyle} />
                </ConfirmField>

                {/* Insurer */}
                <ConfirmField icon="🏢" label="Insurance Company" conf="high">
                  <input type="text" value={confirmedExtraction.insurer_name || ""}
                    placeholder="Insurance company name"
                    onChange={(e) => setConfirmedExtraction({ ...confirmedExtraction, insurer_name: e.target.value })}
                    style={inputStyle} />
                </ConfirmField>

                {/* Service */}
                <ConfirmField icon="💊" label="Service / Treatment Denied" conf="high">
                  <input type="text" value={confirmedExtraction.service_denied || ""}
                    placeholder="What was denied?"
                    onChange={(e) => setConfirmedExtraction({ ...confirmedExtraction, service_denied: e.target.value })}
                    style={inputStyle} />
                </ConfirmField>

                {/* State */}
                <ConfirmField icon="📍" label="State" conf={denialExtraction?.confidence?.state || "low"}>
                  <select value={confirmedExtraction.state || ""}
                    onChange={(e) => setConfirmedExtraction({ ...confirmedExtraction, state: e.target.value })}
                    style={selectStyle}>
                    <option value="">Select state...</option>
                    {Object.entries(STATE_COMMISSIONERS).map(([code, s]) => (
                      <option key={code} value={code}>{s.name}</option>
                    ))}
                  </select>
                </ConfirmField>

                <p style={{ fontSize: 11, color: "rgba(255,215,0,0.4)", fontFamily: "monospace", marginTop: 4 }}>
                  ⚠ yellow fields had low confidence — please review before continuing.
                </p>
              </Card>
            )}

            {/* Battle plan */}
            <Card title="⚔️ Your Battle Plan" subtitle={`Win rate on appeal: ${analysisResult.winRate}`}>
              <div style={{ marginBottom: 20, padding: "14px 16px", background: "rgba(0,229,160,0.08)", borderRadius: 10, border: "1px solid rgba(0,229,160,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#00e5a0" }}>APPEAL SUCCESS PROBABILITY</span>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#00e5a0", fontWeight: 700 }}>{analysisResult.winRate}</span>
                </div>
                <ProgressBar value={parseInt(analysisResult.winRate)} />
                <div style={{ fontSize: 11, color: "rgba(232,244,240,0.4)", marginTop: 6, fontFamily: "monospace" }}>
                  Timeline: {analysisResult.timeline}
                </div>
              </div>

              <div style={{ marginBottom: 20, padding: "14px 16px", background: "rgba(255,60,60,0.06)", borderRadius: 10, border: "1px solid rgba(255,60,60,0.15)" }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: "#ff6060", fontFamily: "monospace", marginBottom: 8 }}>HOW THEIR AI WORKS AGAINST YOU</div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(232,244,240,0.8)", margin: 0 }}>{analysisResult.strategy}</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: "#00e5a0", fontFamily: "monospace", marginBottom: 10 }}>🔑 MAGIC KEYWORDS (use these in your appeal)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {analysisResult.powerWords.map((word) => (
                    <span key={word} style={{
                      background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)",
                      borderRadius: 6, padding: "4px 10px", fontSize: 12, fontFamily: "monospace", color: "#00e5a0",
                    }}>{word}</span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: "#ffd700", fontFamily: "monospace", marginBottom: 10 }}>⚖️ LAWS PROTECTING YOU</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {analysisResult.laws.map((law) => (
                    <div key={law} style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,215,0,0.8)", paddingLeft: 12, borderLeft: "2px solid rgba(255,215,0,0.3)" }}>
                      {law}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: "#e8f4f0", fontFamily: "monospace", marginBottom: 10 }}>📋 ACTION STEPS (do these NOW)</div>
                {analysisResult.tactics.map((tactic, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 12, marginBottom: 10, padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <span style={{ color: "#00e5a0", fontFamily: "monospace", fontSize: 13, minWidth: 20, fontWeight: 700 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(232,244,240,0.8)" }}>{tactic}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={generateLetter}
                style={{
                  background: "linear-gradient(135deg, #ff3c3c, #cc1a1a)",
                  border: "none", borderRadius: 10, padding: "16px 24px", cursor: "pointer",
                  color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "Georgia, serif",
                  letterSpacing: 0.5, width: "100%", transition: "all 0.3s",
                  boxShadow: "0 0 30px rgba(255,60,60,0.3)",
                }}
              >
                ✉️ Looks Right — Draft My Appeal →
              </button>
            </Card>
          </div>
        )}

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

        {step === "letter" && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
            <Card title="✉️ Your Letters" subtitle="Three letters ready to send — tap a tab to switch">
              {generating && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>✍️</div>
                  <p style={{ fontFamily: "monospace", color: "#00e5a0", fontSize: 14 }}>Writing all three letters at once...</p>
                  <p style={{ fontFamily: "monospace", color: "rgba(232,244,240,0.4)", fontSize: 12 }}>Insurance appeal · Hospital · Doctor</p>
                </div>
              )}

              {!generating && letters.insurance && (
                <>
                  <FactsUsedCard citations={visibleCitations} />
                  {/* Tabs */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                    {[
                      { id: "insurance", label: "🏛 Insurance Appeal" },
                      { id: "hospital", label: "🏥 Hospital" },
                      { id: "doctor", label: "👨‍⚕️ Doctor" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setLetterDone(false); }}
                        style={{
                          flex: 1, padding: "10px 6px", cursor: "pointer", fontSize: 12,
                          fontFamily: "Georgia, serif", borderRadius: 8, transition: "all 0.2s",
                          background: activeTab === tab.id ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${activeTab === tab.id ? "#00e5a0" : "rgba(255,255,255,0.1)"}`,
                          color: activeTab === tab.id ? "#00e5a0" : "rgba(232,244,240,0.5)",
                          fontWeight: activeTab === tab.id ? 700 : 400,
                        }}
                      >{tab.label}</button>
                    ))}
                  </div>

                  {/* Letter body */}
                  <div style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: 20, marginBottom: 16, maxHeight: 500, overflowY: "auto",
                  }}>
                    <pre style={{ fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.7, color: "rgba(232,244,240,0.9)", whiteSpace: "pre-wrap", margin: 0 }}>
                      {letterDone
                        ? letters[activeTab]
                        : <TypewriterText key={activeTab} text={letters[activeTab]} speed={8} onDone={() => setLetterDone(true)} />}
                    </pre>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <button onClick={copyLetter} style={{
                      flex: 1, background: copied ? "rgba(0,229,160,0.2)" : "rgba(0,229,160,0.1)",
                      border: "1px solid #00e5a0", borderRadius: 8, padding: "12px 16px", cursor: "pointer",
                      color: "#00e5a0", fontSize: 14, fontFamily: "Georgia, serif", transition: "all 0.2s",
                    }}>
                      {copied ? "✓ Copied!" : "📋 Copy Letter"}
                    </button>
                    <button onClick={generateLetter} style={{
                      flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8, padding: "12px 16px", cursor: "pointer", color: "rgba(232,244,240,0.6)",
                      fontSize: 14, fontFamily: "Georgia, serif",
                    }}>
                      🔄 Regenerate All
                    </button>
                  </div>

                  {confirmedExtraction?.appeal_deadline && (
                    <button
                      onClick={() => downloadAppealReminder({
                        deadline: confirmedExtraction.appeal_deadline,
                        insurerName: confirmedExtraction.insurer_name || insurerName,
                        claimNumber: confirmedExtraction.claim_number || claimNumber,
                        denialReason: DENIAL_REASON_LABELS[confirmedExtraction.denial_reason] || "",
                      })}
                      style={{
                        width: "100%", marginBottom: 12,
                        background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.35)",
                        borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                        color: "#00e5a0", fontSize: 14, fontWeight: 700, fontFamily: "Georgia, serif",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      }}
                    >
                      📅 Add Appeal Deadline to Calendar
                      <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>
                        ({confirmedExtraction.appeal_deadline})
                      </span>
                    </button>
                  )}

                  <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: "#ffd700", fontFamily: "monospace", marginBottom: 8 }}>⚠️ AFTER SENDING YOUR LETTERS</div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(232,244,240,0.7)", fontFamily: "monospace" }}>
                      1. Send via certified mail AND fax — create a paper trail<br />
                      2. Note the date — insurers have strict response deadlines<br />
                      3. If denied again → request External Independent Review (free)<br />
                      4. File a complaint with your State Insurance Commissioner<br />
                      5. Last resort: contact your employer's HR / benefits dept (for group plans)
                    </div>
                  </div>
                </>
              )}

              <button onClick={reset} style={{
                width: "100%", marginTop: 16, background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "12px", cursor: "pointer", color: "rgba(232,244,240,0.4)",
                fontSize: 13, fontFamily: "Georgia, serif",
              }}>
                ← Start New Appeal
              </button>
            </Card>
          </div>
        )}

        <HeavyHittersFooter />

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "rgba(232,244,240,0.25)", fontFamily: "monospace", lineHeight: 1.8 }}>
          healthcareadvocate.org — Not legal advice. Consult a healthcare attorney for complex cases.
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          from { opacity: 0.3; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1.2); }
        }
        .blink { animation: blink 0.8s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        textarea:focus { border-color: rgba(0,229,160,0.5) !important; box-shadow: 0 0 0 2px rgba(0,229,160,0.1); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,229,160,0.3); border-radius: 2px; }
      `}</style>
    </div>
  );
}

const STATE_COMMISSIONERS = {
  "Alabama": { phone: "1-800-433-3966", url: "https://www.aldoi.gov/ConsumerServices/FileComplaint.aspx" },
  "Alaska": { phone: "1-907-269-7900", url: "https://www.commerce.alaska.gov/web/ins/Consumers/FileaComplaint.aspx" },
  "Arizona": { phone: "1-602-364-2499", url: "https://difi.az.gov/consumer/file-complaint-against-insurance-company" },
  "Arkansas": { phone: "1-800-852-5494", url: "https://insurance.arkansas.gov/consumer-services/file-a-complaint/" },
  "California": { phone: "1-800-927-4357", url: "https://www.insurance.ca.gov/01-consumers/101-help/" },
  "Colorado": { phone: "1-800-930-3745", url: "https://doi.colorado.gov/insurance-products/file-a-complaint" },
  "Connecticut": { phone: "1-800-203-3447", url: "https://portal.ct.gov/cid/Consumer-Affairs/File-a-Complaint-or-Ask-a-Question" },
  "Delaware": { phone: "1-800-282-8611", url: "https://insurance.delaware.gov/services/filecomplaint/" },
  "Washington DC": { phone: "1-202-727-8000", url: "https://disb.dc.gov/page/file-complaint-or-report-fraud" },
  "Florida": { phone: "1-877-693-5236", url: "https://apps.fldfs.com/eServices/Consumer/Complaint/" },
  "Georgia": { phone: "1-800-656-2298", url: "https://oci.georgia.gov/file-consumer-complaint" },
  "Hawaii": { phone: "1-808-586-2790", url: "https://cca.hawaii.gov/ins/consumers/filing_a_complaint/" },
  "Idaho": { phone: "1-800-721-3272", url: "https://doi.idaho.gov/consumer/complaint/" },
  "Illinois": { phone: "1-866-445-5364", url: "https://idoi.illinois.gov/consumers/file-a-complaint.html" },
  "Indiana": { phone: "1-800-622-4461", url: "https://www.in.gov/idoi/consumer-services/file-a-complaint/" },
  "Iowa": { phone: "1-877-955-1212", url: "https://iid.iowa.gov/consumers/filing-a-complaint" },
  "Kansas": { phone: "1-800-432-2484", url: "https://insurance.kansas.gov/file-a-complaint/" },
  "Kentucky": { phone: "1-800-595-6053", url: "https://insurance.ky.gov/ppc/Contact.aspx" },
  "Louisiana": { phone: "1-800-259-5300", url: "https://www.ldi.la.gov/consumers/insurance-complaint" },
  "Maine": { phone: "1-800-300-5000", url: "https://www.maine.gov/pfr/insurance/consumer/file-complaint" },
  "Maryland": { phone: "1-800-492-6116", url: "https://www.insurance.maryland.gov/Consumer/Pages/FileAComplaint.aspx" },
  "Massachusetts": { phone: "1-617-521-7794", url: "https://www.mass.gov/how-to/file-an-insurance-complaint" },
  "Michigan": { phone: "1-877-999-6442", url: "https://www.michigan.gov/difs/complaint" },
  "Minnesota": { phone: "1-800-657-3602", url: "https://mn.gov/commerce/consumers/file-a-complaint/" },
  "Mississippi": { phone: "1-800-562-2957", url: "https://www.mid.ms.gov/consumer/file-complaint.aspx" },
  "Missouri": { phone: "1-800-726-7390", url: "https://insurance.mo.gov/consumers/complaints/" },
  "Montana": { phone: "1-800-332-6148", url: "https://csimt.gov/your-insurance/complaints/" },
  "Nebraska": { phone: "1-877-564-7323", url: "https://doi.nebraska.gov/consumer/consumer-complaints" },
  "Nevada": { phone: "1-888-872-3234", url: "https://doi.nv.gov/Consumers/File-a-Complaint/" },
  "New Hampshire": { phone: "1-800-852-3416", url: "https://www.nh.gov/insurance/consumers/complaints.htm" },
  "New Jersey": { phone: "1-609-292-7272", url: "https://www.nj.gov/dobi/consumer.htm" },
  "New Mexico": { phone: "1-855-427-5674", url: "https://www.osi.state.nm.us/index.php/consumers/consumer-assistance-bureau/" },
  "New York": { phone: "1-800-342-3736", url: "https://www.dfs.ny.gov/complaints/file_general_consumer_complaint" },
  "North Carolina": { phone: "1-855-408-1212", url: "https://www.ncdoi.gov/consumers/choosing-insurance/file-complaint" },
  "North Dakota": { phone: "1-800-247-0560", url: "https://www.insurance.nd.gov/consumers/filing-complaint" },
  "Ohio": { phone: "1-800-686-1526", url: "https://insurance.ohio.gov/consumers/file-a-complaint" },
  "Oklahoma": { phone: "1-800-522-0071", url: "https://www.oid.ok.gov/consumers/file-a-complaint/" },
  "Oregon": { phone: "1-888-877-4894", url: "https://dfr.oregon.gov/help/complaints-licenses/Pages/file-complaint.aspx" },
  "Pennsylvania": { phone: "1-877-881-6388", url: "https://www.insurance.pa.gov/Consumers/FileaComplaint/Pages/default.aspx" },
  "Rhode Island": { phone: "1-401-462-9520", url: "https://dbr.ri.gov/insurance-banking-securities-and-charitable-organizations/insurance/insurance-consumer-0" },
  "South Carolina": { phone: "1-800-768-3467", url: "https://doi.sc.gov/9/Consumers" },
  "South Dakota": { phone: "1-605-773-3563", url: "https://dlr.sd.gov/insurance/consumers/file_complaint.aspx" },
  "Tennessee": { phone: "1-800-342-4029", url: "https://www.tn.gov/commerce/insurance/consumer-resources/file-a-complaint.html" },
  "Texas": { phone: "1-800-252-3439", url: "https://www.tdi.texas.gov/consumer/complaint-home.html" },
  "Utah": { phone: "1-800-439-3805", url: "https://insurance.utah.gov/consumer/complaints" },
  "Vermont": { phone: "1-800-964-1784", url: "https://dfr.vermont.gov/consumers/file-complaint" },
  "Virginia": { phone: "1-877-310-6560", url: "https://scc.virginia.gov/pages/File-an-Insurance-Complaint" },
  "Washington": { phone: "1-800-562-6900", url: "https://www.insurance.wa.gov/file-complaint-or-check-your-complaint-status" },
  "West Virginia": { phone: "1-888-435-0308", url: "https://www.wvinsurance.gov/Consumer-Services" },
  "Wisconsin": { phone: "1-800-236-8517", url: "https://oci.wi.gov/Pages/Consumers/FilingaComplaint.aspx" },
  "Wyoming": { phone: "1-800-438-5768", url: "https://doi.wyo.gov/consumers/file-a-complaint" },
};

function HeavyHittersFooter() {
  const [open, setOpen] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const commissioner = selectedState ? STATE_COMMISSIONERS[selectedState] : null;

  return (
    <div style={{ marginTop: 32, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.25)",
          borderRadius: 12, padding: "14px 20px", cursor: "pointer", color: "#ff6060",
          fontSize: 15, fontWeight: 700, fontFamily: "Georgia, serif",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}
      >
        🚨 Call In The Heavy Hitters {open ? "▲" : "▼"}
      </button>
      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(232,244,240,0.3)", fontFamily: "monospace", marginTop: 6 }}>
        State Insurance Commissioner · Your Congressional Representative
      </p>

      {open && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* State Commissioner */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px" }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#ffd700", fontFamily: "monospace", marginBottom: 10 }}>⚖️ STATE INSURANCE COMMISSIONER</div>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              style={{
                width: "100%", background: "#1a2535", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8, padding: "10px 12px", color: "#e8f4f0", fontSize: 14,
                fontFamily: "Georgia, serif", outline: "none", marginBottom: 12,
              }}
            >
              <option value="">Select your state...</option>
              {Object.keys(STATE_COMMISSIONERS).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {commissioner && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href={`tel:${commissioner.phone.replace(/[^0-9]/g, "")}`} style={{
                  display: "flex", alignItems: "center", gap: 10, background: "rgba(0,229,160,0.1)",
                  border: "1px solid rgba(0,229,160,0.3)", borderRadius: 8, padding: "12px 16px",
                  color: "#00e5a0", textDecoration: "none", fontSize: 15, fontWeight: 700, fontFamily: "monospace",
                }}>
                  📞 {commissioner.phone}
                </a>
                <a href={commissioner.url} target="_blank" rel="noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 16px",
                  color: "rgba(232,244,240,0.6)", textDecoration: "none", fontSize: 13, fontFamily: "monospace",
                }}>
                  🌐 File a formal complaint online →
                </a>
              </div>
            )}
          </div>

          {/* Congressional Rep */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px" }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#ffd700", fontFamily: "monospace", marginBottom: 10 }}>🏛️ YOUR CONGRESSIONAL REPRESENTATIVES</div>
            <p style={{ fontSize: 12, color: "rgba(232,244,240,0.5)", fontFamily: "monospace", marginBottom: 14, lineHeight: 1.5 }}>
              Enter your address below to view your specific federal representatives, their direct Washington D.C. office phone numbers, and contact forms instantly.
            </p>
            <div style={{ width: "100%", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden", background: "#0d1117" }}>
              <iframe
                src="https://democracy.io/embedded-lookup/"
                title="Find Your Representatives"
                style={{ width: "100%", height: 450, border: "none", display: "block" }}
                loading="lazy"
              />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "#1a2535", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8, padding: "9px 12px", color: "#e8f4f0", fontSize: 14,
  fontFamily: "Georgia, serif", outline: "none", boxSizing: "border-box",
};

const selectStyle = {
  ...inputStyle,
  background: "#1a2535",
  color: "#e8f4f0",
  cursor: "pointer",
  appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2300e5a0' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 32,
};

function ConfirmField({ icon, label, children, conf, critical, hint }) {
  const isLow = conf === "low" || critical;
  return (
    <div style={{
      marginBottom: 12, padding: "10px 14px", borderRadius: 8,
      background: isLow ? "rgba(255,215,0,0.05)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isLow ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.07)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 10, letterSpacing: 2, fontFamily: "monospace", color: isLow ? "#ffd700" : "rgba(232,244,240,0.7)", textTransform: "uppercase" }}>
          {label}{isLow ? " ⚠" : ""}
        </span>
      </div>
      {children}
      {hint && <p style={{ fontSize: 11, color: "rgba(255,215,0,0.6)", fontFamily: "monospace", margin: "6px 0 0" }}>{hint}</p>}
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
      padding: "24px 20px", marginBottom: 16,
      boxShadow: "0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
    }}>
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>{title}</h2>
        {subtitle && <p style={{ margin: 0, fontSize: 12, color: "rgba(232,244,240,0.45)", fontFamily: "monospace", letterSpacing: 1 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#00e5a0", fontFamily: "monospace", display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, padding: "10px 12px", color: "#e8f4f0", fontSize: 13, fontFamily: "Georgia, serif",
          outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
        }}
      />
    </div>
  );
}
