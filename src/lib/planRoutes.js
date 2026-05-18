// Legal framework routing table.
// Keyed by plan_type from the analyzeDenial() extraction.
// This is the source of legal authority — prompts must use ONLY these citations.
// Update this file to change legal framework; never hardcode citations in prompts.

const PLAN_ROUTES = {
  employer_erisa: {
    governingLaw: "ERISA § 503, 29 C.F.R. § 2560.503-1",
    appealPath: "Internal appeal → External Independent Review Organization (IRO)",
    citations: ["ERISA § 503", "ERISA § 502(a)", "29 C.F.R. § 2560.503-1"],
    keyRules: [
      "Insurer must decide within 60 days for standard appeals, 72 hours for urgent/expedited",
      "Member is entitled to the complete claim file on request at no cost",
      "External Independent Review is available after exhausting internal appeals",
      "Denial notice must cite the specific plan provision and clinical criteria used",
    ],
    doNotCite: "Do NOT cite Medicare or Medicaid appeal regulations — they do not apply to employer plans.",
  },

  aca_marketplace: {
    governingLaw: "45 C.F.R. § 147.136, ACA § 2719",
    appealPath: "Internal appeal → External review (state-administered or HHS-administered)",
    citations: ["45 C.F.R. § 147.136", "ACA § 2719", "ACA § 1302 (Essential Health Benefits)"],
    keyRules: [
      "Internal appeal decision within 30 days (non-urgent) or 72 hours (urgent)",
      "External review available at no cost after internal appeal is exhausted",
      "Essential health benefits — including preventive care, mental health, and prescription drugs — cannot be denied",
      "Insurer must provide a written notice with the specific reason and applicable plan language",
    ],
    doNotCite: "Do NOT cite ERISA § 503 — ACA marketplace plans have their own appeal framework under 45 C.F.R. § 147.136.",
  },

  medicare_advantage: {
    governingLaw: "42 C.F.R. Part 422, Subpart M",
    appealPath: "Organization Determination → Reconsideration → Independent Review Entity (IRE) → ALJ Hearing → Medicare Appeals Council → Federal District Court",
    citations: ["42 C.F.R. Part 422, Subpart M", "42 C.F.R. § 422.562", "42 C.F.R. § 422.566", "42 C.F.R. § 422.578"],
    keyRules: [
      "Expedited (urgent) reconsideration: plan must decide within 72 hours",
      "Standard reconsideration: plan must decide within 30 days",
      "If plan upholds denial, case is automatically sent to the Independent Review Entity (IRE)",
      "ALJ hearing available when amount in controversy meets threshold",
      "File a complaint with CMS directly if plan violates appeal timelines",
    ],
    doNotCite: "Do NOT cite ERISA — Medicare Advantage plans are governed by 42 C.F.R. Part 422, not ERISA.",
  },

  original_medicare: {
    governingLaw: "42 C.F.R. Part 405, Subpart I",
    appealPath: "Redetermination (MAC) → Reconsideration (QIC) → ALJ Hearing → Medicare Appeals Council → Federal District Court",
    citations: ["42 C.F.R. Part 405, Subpart I", "42 C.F.R. § 405.940", "42 C.F.R. § 405.960", "42 C.F.R. § 405.1000"],
    keyRules: [
      "Redetermination request must be filed within 120 days of the initial determination",
      "Medicare contractor must issue redetermination within 60 days",
      "Qualified Independent Contractor (QIC) reconsideration within 60 days",
      "ALJ hearing available when amount in controversy is $180 or more (2024 threshold)",
      "Beneficiary has right to a fast (expedited) appeal for hospital discharge decisions",
    ],
    doNotCite: "Do NOT cite ERISA — ERISA does not apply to traditional Medicare (Parts A and B).",
  },

  medicaid: {
    governingLaw: "State Medicaid Fair Hearing regulations; 42 C.F.R. § 431.200 (federal fair hearing requirement)",
    appealPath: "State Fair Hearing (administered by the state, not a federal process)",
    citations: ["42 C.F.R. § 431.200", "42 C.F.R. § 431.205", "State Medicaid Fair Hearing rules"],
    keyRules: [
      "Request a State Fair Hearing — this is the primary appeal path for Medicaid",
      "The state must provide a fair hearing within a reasonable time",
      "Legal aid organizations in most states provide free Medicaid appeal assistance",
      "Coverage must continue during the appeal if the request is filed in time",
    ],
    doNotCite: "CRITICAL: Do NOT cite ERISA — ERISA explicitly does not apply to Medicaid. Do NOT cite Medicare appeal regulations. Use state Fair Hearing rights only.",
  },

  fehb: {
    governingLaw: "5 C.F.R. § 890.105, Federal Employees Health Benefits Act (5 U.S.C. § 8902)",
    appealPath: "Disputed claim review with the carrier → OPM review",
    citations: ["5 C.F.R. § 890.105", "5 U.S.C. § 8902", "5 U.S.C. § 8901"],
    keyRules: [
      "File a disputed claim in writing with the insurance carrier within 6 months of the denial",
      "If the carrier upholds the denial, request OPM (Office of Personnel Management) review",
      "OPM review is the final administrative remedy for FEHB disputes",
      "Federal employees may also contact their agency's benefits office for assistance",
    ],
    doNotCite: "Do NOT cite ERISA — FEHB plans are specifically exempt from ERISA under 5 U.S.C. § 8909(f). Do NOT cite ACA marketplace appeal rules.",
  },
};

// Returns the routing entry for a confirmed plan type.
// Returns null if plan_type is "unclear" — callers must handle this and block generation.
export function getRoute(planType) {
  if (!planType || planType === "unclear") return null;
  return PLAN_ROUTES[planType] || null;
}

// Returns a formatted string for injection into the letter-writing prompt.
export function buildLegalFramework(planType) {
  const route = getRoute(planType);
  if (!route) return null;

  return `LEGAL FRAMEWORK — use ONLY these citations. Do not introduce any other legal citations.
Governing Law: ${route.governingLaw}
Appeal Path: ${route.appealPath}
Cite specifically: ${route.citations.join("; ")}
Key rules to reference: ${route.keyRules.join(" | ")}
${route.doNotCite}`;
}

// Vite imports all template markdown files at build time as raw strings.
// Key format: "../templates/<plan_type>/<denial_reason>.md"
const TEMPLATES = import.meta.glob('../templates/**/*.md', { eager: true, query: '?raw', import: 'default' });

// Returns the template markdown for a given plan_type + denial_reason, or null.
// denial_reason uses the normalized keys from the extraction schema.
export function loadTemplate(planType, denialReason) {
  if (!planType || planType === "unclear") return null;
  const key = `../templates/${planType}/${denialReason}.md`;
  return TEMPLATES[key] || null;
}
