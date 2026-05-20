import es from '../i18n/es'

export function FactsUsedCard({ citations, lang = 'en' }) {
  const tr = (key, english) => (lang === 'es' && es[key]) ? es[key] : english
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
        {tr('verifiedSourcesTitle', '🛡️ VERIFIED SOURCES USED')}
      </div>
      <p style={{ fontSize: 13, color: "rgba(232,244,240,0.65)", fontFamily: "monospace", marginBottom: 14, lineHeight: 1.5 }}>
        {tr('verifiedSourcesBody', 'To prevent mistakes, this appeal was written using the following official rules:')}
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
        {tr('verifiedSourcesFooter', 'No private data left your device to look up these rules.')}
      </p>
    </div>
  )
}
