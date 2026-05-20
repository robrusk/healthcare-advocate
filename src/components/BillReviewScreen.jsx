import es from '../i18n/es'

export default function BillReviewScreen({ bill, onGenerate, onSwitch, lang = 'en' }) {
  const tr = (key, english) => (lang === 'es' && es[key]) ? es[key] : english
  const FLAG_LABELS = {
    missing_code: { icon: '⚠', label: tr('flagMissingCode', 'No billing code'), color: '#ffd700' },
    vague_description: { icon: '⚠', label: tr('flagVague', 'Vague description'), color: '#ffd700' },
    possible_duplicate: { icon: '🚨', label: tr('flagDuplicate', 'Possible duplicate'), color: '#ff6060' },
    biller_error: { icon: '🚨', label: tr('flagBillerError', 'Possible biller error'), color: '#ff6060' },
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeSlideIn 0.5s ease' }}>

      {/* Billing Phone — Big Red Box */}
      <div style={{
        background: 'rgba(255,60,60,0.12)', border: '2px solid rgba(255,60,60,0.5)',
        borderRadius: 12, padding: '16px 20px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: '#ff6060', fontFamily: 'monospace', marginBottom: 8 }}>
          {tr('billingDept', '📞 BILLING DEPARTMENT')}
        </div>
        {bill.billing_phone ? (
          <a href={`tel:${bill.billing_phone.replace(/\D/g, '')}`} style={{
            fontSize: 20, fontWeight: 700, color: '#ff6060', textDecoration: 'none',
            fontFamily: 'monospace', letterSpacing: 1,
          }}>
            {bill.billing_phone}
          </a>
        ) : (
          <p style={{ fontSize: 14, color: 'rgba(232,244,240,0.7)', margin: 0, fontFamily: 'Georgia, serif' }}>
            {tr('callBillingDept', 'Call the number on your bill and ask for the Billing Department.')}
          </p>
        )}
      </div>

      {/* Biller Error Warning */}
      {bill.biller_error_detected && (
        <div style={{
          background: 'rgba(255,60,60,0.08)', border: '2px solid rgba(255,60,60,0.4)',
          borderRadius: 12, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6060', marginBottom: 8, fontFamily: 'Georgia, serif' }}>
            {tr('billerErrorTitle', '🚨 BILLING ERROR - THIS MAY NOT BE YOUR RESPONSIBILITY')}
          </div>
          <p style={{ fontSize: 13, color: 'rgba(232,244,240,0.8)', lineHeight: 1.6, margin: '0 0 8px', fontFamily: 'Georgia, serif' }}>
            {bill.biller_error_description}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(232,244,240,0.5)', margin: 0, fontFamily: 'monospace' }}>
            {tr('billerErrorNote', 'If the biller submitted to the wrong insurance company or missed a filing deadline, you are not legally required to pay for their mistake. The dispute letter below addresses this.')}
          </p>
        </div>
      )}

      {/* Plain English Summary */}
      {bill.plain_english && (
        <div style={{
          background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#00e5a0', fontFamily: 'monospace', marginBottom: 8 }}>
            {tr('whatBillIsFor', '📋 WHAT THIS BILL IS FOR')}
          </div>
          <p style={{ fontSize: 14, color: 'rgba(232,244,240,0.9)', lineHeight: 1.7, margin: 0, fontFamily: 'Georgia, serif' }}>
            {bill.plain_english}
          </p>
        </div>
      )}

      {/* Line Items */}
      {bill.line_items.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(232,244,240,0.4)', fontFamily: 'monospace', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {tr('chargesLabel', 'CHARGES')}
          </div>
          {bill.line_items.map((item, i) => (
            <div key={i} style={{
              padding: '12px 14px',
              borderBottom: i < bill.line_items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              background: item.flags.length > 0 ? 'rgba(255,215,0,0.03)' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#e8f4f0', fontFamily: 'Georgia, serif', marginBottom: 2 }}>
                    {item.description}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(232,244,240,0.35)', fontFamily: 'monospace' }}>
                    {item.code || tr('noBillingCode', 'No billing code')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e8f4f0', fontFamily: 'monospace' }}>
                    {item.amount || '—'}
                  </div>
                </div>
              </div>
              {item.flags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {item.flags.map((flag) => {
                    const f = FLAG_LABELS[flag] || { icon: '⚠', label: flag, color: '#ffd700' }
                    return (
                      <span key={flag} style={{
                        fontSize: 11, fontFamily: 'monospace', color: f.color,
                        background: `${f.color}18`, border: `1px solid ${f.color}44`,
                        borderRadius: 4, padding: '2px 8px',
                      }}>
                        {f.icon} {f.label}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Missing Info */}
      {bill.missing_info.length > 0 && (
        <div style={{
          background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.25)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#ffd700', fontFamily: 'monospace', marginBottom: 8 }}>
            {tr('missingInfoTitle', '⚠ THIS BILL IS MISSING REQUIRED INFORMATION')}
          </div>
          {bill.missing_info.map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: 'rgba(232,244,240,0.7)', fontFamily: 'Georgia, serif', marginBottom: 4 }}>
              • {item}
            </div>
          ))}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        style={{
          background: 'linear-gradient(135deg, #ff3c3c, #cc1a1a)',
          border: 'none', borderRadius: 10, padding: '16px 24px', cursor: 'pointer',
          color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Georgia, serif',
          width: '100%', boxShadow: '0 0 30px rgba(255,60,60,0.3)',
        }}
      >
        {tr('generateDisputeLetters', '✉️ Generate Dispute Letters →')}
      </button>

      {/* Switch link */}
      <button
        onClick={onSwitch}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(232,244,240,0.3)', fontSize: 12, fontFamily: 'monospace',
          textDecoration: 'underline',
        }}
      >
        {tr('switchToDenialFlow', 'Switch to denial letter flow instead')}
      </button>
    </div>
  )
}
