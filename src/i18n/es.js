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
