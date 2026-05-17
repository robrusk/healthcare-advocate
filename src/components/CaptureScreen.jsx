export default function CaptureScreen({ onCapture }) {
  function handleChange(e) {
    const file = e.target.files[0]
    if (file) onCapture(file)
  }

  return (
    <div className="screen capture-screen">
      <h1 className="app-title">Patient Advocate</h1>
      <p className="tagline">Fighting insurance denials, one family at a time.</p>
      <label className="capture-btn" htmlFor="camera-input">
        📷 Photograph Denial Letter
      </label>
      <input
        id="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <p className="hint">Take a clear photo of your denial letter</p>
    </div>
  )
}
