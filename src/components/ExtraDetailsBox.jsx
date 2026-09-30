import es from '../i18n/es'
import { EXTRA_DETAILS_MAX } from '../lib/extraDetails'

// Optional free-text box shown just above the "generate letters" button
export default function ExtraDetailsBox({ value, onChange, lang = 'en' }) {
  const tr = (key, english) => (lang === 'es' && es[key]) ? es[key] : english
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor="extra-details" style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#00e5a0', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>
        {tr('extraDetailsLabel', 'Anything else we should know? (optional)')}
      </label>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: 'rgba(232,244,240,0.5)', fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
        {tr('extraDetailsHelp', "Add facts that help your case, like how long you've used a treatment, what your doctor said, or what you already tried. Please don't include Social Security or bank numbers.")}
      </p>
      <textarea
        id="extra-details"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, EXTRA_DETAILS_MAX))}
        maxLength={EXTRA_DETAILS_MAX}
        placeholder={tr('extraDetailsPlaceholder', "Example: I've taken this medicine for 6 years. My doctor says the cheaper one made me sick in 2023.")}
        rows={4}
        style={{
          width: '100%', background: '#1a2535', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: 12, color: '#e8f4f0', fontSize: 14, fontFamily: 'Georgia, serif',
          resize: 'vertical', outline: 'none', boxSizing: 'border-box',
        }}
      />
      <div aria-live="polite" style={{ textAlign: 'right', fontSize: 11, fontFamily: 'monospace', marginTop: 4, color: value.length >= EXTRA_DETAILS_MAX ? '#ffd700' : 'rgba(232,244,240,0.35)' }}>
        {value.length} / {EXTRA_DETAILS_MAX}
      </div>
    </div>
  )
}
