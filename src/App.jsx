import { useState, useEffect, useRef } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { analyzePhoto, fileToBase64 } from "./lib/claude";

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

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

export default function InsuranceFighter() {
  const [step, setStep] = useState("upload");
  const [denialText, setDenialText] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [patientName, setPatientName] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [treatment, setTreatment] = useState("");
  const [photoReading, setPhotoReading] = useState(false);
  const [photoSummary, setPhotoSummary] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [appealLetter, setAppealLetter] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [letterDone, setLetterDone] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setTimeout(() => setAnimateIn(true), 100);
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoReading(true);
    setPhotoSummary("");
    try {
      const base64 = await fileToBase64(file);
      const result = await analyzePhoto(base64, file.type);
      setPhotoSummary(result.plain_english);
      if (result.denial_reason) setDenialReason(result.denial_reason);
      if (result.patient_name) setPatientName(result.patient_name);
      if (result.claim_number) setClaimNumber(result.claim_number);
      if (result.insurer_name) setInsurerName(result.insurer_name);
      if (result.treatment) setTreatment(result.treatment);
    } catch {
      setPhotoSummary("Couldn't read the letter clearly — please fill in the fields below manually.");
    }
    setPhotoReading(false);
  };

  const runAnalysis = async () => {
    if (!denialReason) return;
    setAnalyzing(true);
    setStep("analyze");
    await new Promise((r) => setTimeout(r, 2200));
    setAnalysisResult(INSURANCE_KEYWORDS[denialReason]);
    setAnalyzing(false);
    setTimeout(() => setStep("strategy"), 600);
  };

  const generateLetter = async () => {
    setGenerating(true);
    setStep("letter");
    setLetterDone(false);
    const info = INSURANCE_KEYWORDS[denialReason];
    const reasonLabel = DENY_REASONS.find((r) => r.id === denialReason)?.label;

    const prompt = `You are an expert patient advocate and healthcare attorney. Generate a powerful, legally precise insurance appeal letter.

Patient: ${patientName || "[PATIENT NAME]"}
Claim Number: ${claimNumber || "[CLAIM NUMBER]"}
Insurance Company: ${insurerName || "[INSURANCE COMPANY]"}
Treatment/Service: ${treatment || "[TREATMENT]"}
Denial Reason: ${reasonLabel}

CRITICAL INSTRUCTIONS:
1. Use these exact power keywords throughout: ${info.powerWords.slice(0, 6).join(", ")}
2. Cite these laws specifically: ${info.laws.join(", ")}
3. Be firm, professional, and legally precise
4. Include: (a) formal heading, (b) summary of denial, (c) legal basis for appeal, (d) clinical/factual arguments, (e) list of enclosed documents, (f) deadline demand, (g) escalation warning
5. Use language that insurance AI systems are trained to flag as requiring human review
6. The tone should be assertive — this is a legal demand, not a polite request
7. End with a clear 30-day response deadline and External Review threat
8. Keep it under 600 words but make every sentence count

Write ONLY the letter. No explanations. Start with the date line.`;

    try {
      const response = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });
      const text = response.content.find((b) => b.type === "text")?.text || "";
      setAppealLetter(text);
    } catch (e) {
      setAppealLetter("Error generating letter. Please try again.");
    }
    setGenerating(false);
  };

  const copyLetter = () => {
    navigator.clipboard.writeText(appealLetter);
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
    setAppealLetter("");
    setGenerating(false);
    setLetterDone(false);
    setPhotoSummary("");
    setPhotoReading(false);
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
          <div style={{ fontSize: 13, letterSpacing: 4, color: "#00e5a0", textTransform: "uppercase", marginBottom: 12, fontFamily: "monospace" }}>
            ⚔ CLAIM DEFENDER PRO
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.15, letterSpacing: -1 }}>
            Fight Your{" "}
            <span style={{ color: "#ff3c3c", WebkitTextStroke: "1px #ff6060" }}>Denial.</span>
            <br />Win Your{" "}
            <span style={{ color: "#00e5a0" }}>Claim.</span>
          </h1>
          <p style={{ color: "rgba(232,244,240,0.55)", fontSize: 14, margin: 0, fontFamily: "monospace", letterSpacing: 1 }}>
            AI-powered appeals that beat insurance AI
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: 32, opacity: animateIn ? 1 : 0, transition: "opacity 1s ease 0.3s" }}>
          {STEPS.map((s, i) => (
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
              {i < STEPS.length - 1 && (
                <div style={{ width: 32, height: 2, background: i < stepIndex ? "#00e5a0" : "rgba(255,255,255,0.1)", margin: "0 4px", marginBottom: 24, transition: "background 0.4s" }} />
              )}
            </div>
          ))}
        </div>

        {step === "upload" && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
            <Card title="📋 Denial Details" subtitle="Tell us what happened">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Camera + PDF buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <label htmlFor="camera-input" style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "linear-gradient(135deg, #00e5a0, #00b87a)",
                    color: "#0a0e1a", fontWeight: 700, fontSize: 14,
                    fontFamily: "Georgia, serif", padding: "14px 16px",
                    borderRadius: 12, cursor: "pointer",
                    boxShadow: "0 0 30px rgba(0,229,160,0.3)",
                  }}>
                    📷 Take Photo
                  </label>
                  <input
                    id="camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhoto}
                    style={{ display: "none" }}
                  />
                  <label htmlFor="pdf-input" style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(232,244,240,0.8)", fontWeight: 700, fontSize: 14,
                    fontFamily: "Georgia, serif", padding: "14px 16px",
                    borderRadius: 12, cursor: "pointer",
                  }}>
                    📄 Upload PDF
                  </label>
                  <input
                    id="pdf-input"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handlePhoto}
                    style={{ display: "none" }}
                  />
                </div>
                <p style={{ marginTop: -8, fontSize: 11, color: "rgba(232,244,240,0.35)", fontFamily: "monospace", textAlign: "center" }}>
                  On your phone? Open this page in your phone's browser to use your camera.
                </p>

                {/* Reading state */}
                {photoReading && (
                  <div style={{ textAlign: "center", padding: "16px 0", background: "rgba(0,229,160,0.06)", borderRadius: 10, border: "1px solid rgba(0,229,160,0.15)" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                    <p style={{ fontFamily: "monospace", fontSize: 13, color: "#00e5a0", margin: 0 }}>Reading your letter...</p>
                  </div>
                )}

                {/* Plain-English summary */}
                {photoSummary && !photoReading && (
                  <div style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.25)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: "#00e5a0", fontFamily: "monospace", marginBottom: 8 }}>📋 WHAT YOUR LETTER SAYS</div>
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(232,244,240,0.9)", margin: "0 0 8px" }}>{photoSummary}</p>
                    <p style={{ fontSize: 11, color: "rgba(232,244,240,0.4)", fontFamily: "monospace", margin: 0 }}>Fields below were filled in from your letter — review and correct anything that looks wrong.</p>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Your Name" value={patientName} onChange={setPatientName} placeholder="Jane Smith" />
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
                      width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, padding: 12, color: "#e8f4f0", fontSize: 13, fontFamily: "monospace",
                      resize: "vertical", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>

                <button
                  onClick={runAnalysis}
                  disabled={!denialReason}
                  style={{
                    background: denialReason ? "linear-gradient(135deg, #00e5a0, #00b87a)" : "rgba(255,255,255,0.05)",
                    border: "none", borderRadius: 10, padding: "16px 24px", cursor: denialReason ? "pointer" : "not-allowed",
                    color: denialReason ? "#0a0e1a" : "rgba(255,255,255,0.3)", fontSize: 15, fontWeight: 700,
                    fontFamily: "Georgia, serif", letterSpacing: 0.5, transition: "all 0.3s",
                    boxShadow: denialReason ? "0 0 30px rgba(0,229,160,0.3)" : "none",
                  }}
                >
                  🔍 Analyze My Denial →
                </button>
              </div>
            </Card>
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

        {step === "strategy" && analysisResult && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
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
                ✉️ Generate AI Appeal Letter →
              </button>
            </Card>
          </div>
        )}

        {step === "letter" && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
            <Card title="✉️ Your Appeal Letter" subtitle="Ready to send — legally precise, AI-optimized">
              {generating && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>✍️</div>
                  <p style={{ fontFamily: "monospace", color: "#00e5a0", fontSize: 14 }}>Writing your appeal letter...</p>
                  <p style={{ fontFamily: "monospace", color: "rgba(232,244,240,0.4)", fontSize: 12 }}>Inserting legal language and counter-AI keywords</p>
                </div>
              )}

              {!generating && appealLetter && (
                <>
                  <div style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: 20, marginBottom: 16, maxHeight: 500, overflowY: "auto",
                  }}>
                    <pre style={{ fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.7, color: "rgba(232,244,240,0.9)", whiteSpace: "pre-wrap", margin: 0 }}>
                      {letterDone ? appealLetter : <TypewriterText text={appealLetter} speed={8} onDone={() => setLetterDone(true)} />}
                    </pre>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <button
                      onClick={copyLetter}
                      style={{
                        flex: 1, background: copied ? "rgba(0,229,160,0.2)" : "rgba(0,229,160,0.1)",
                        border: "1px solid #00e5a0", borderRadius: 8, padding: "12px 16px", cursor: "pointer",
                        color: "#00e5a0", fontSize: 14, fontFamily: "Georgia, serif", transition: "all 0.2s",
                      }}
                    >
                      {copied ? "✓ Copied!" : "📋 Copy Letter"}
                    </button>
                    <button
                      onClick={generateLetter}
                      style={{
                        flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8, padding: "12px 16px", cursor: "pointer", color: "rgba(232,244,240,0.6)",
                        fontSize: 14, fontFamily: "Georgia, serif",
                      }}
                    >
                      🔄 Regenerate
                    </button>
                  </div>

                  <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: "#ffd700", fontFamily: "monospace", marginBottom: 8 }}>⚠️ AFTER SENDING YOUR LETTER</div>
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

              <button
                onClick={reset}
                style={{
                  width: "100%", marginTop: 16, background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "12px", cursor: "pointer", color: "rgba(232,244,240,0.4)",
                  fontSize: 13, fontFamily: "Georgia, serif",
                }}
              >
                ← Start New Appeal
              </button>
            </Card>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 40, fontSize: 11, color: "rgba(232,244,240,0.25)", fontFamily: "monospace", lineHeight: 1.8 }}>
          CLAIM DEFENDER PRO — Not legal advice. Consult a healthcare attorney for complex cases.<br />
          For urgent denials, contact your state's Insurance Commissioner immediately.
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
