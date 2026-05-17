export default function ResultsScreen({ result, onReset }) {
  async function copyLetter() {
    await navigator.clipboard.writeText(result.letter)
  }

  return (
    <div className="screen results-screen">
      <div className="result-card">
        <h2>What This Denial Means</h2>
        <p>{result.analysis}</p>
      </div>

      <div className="result-card">
        <h2>Your Appeal Letter</h2>
        <p className="letter-text">{result.letter}</p>
        <button className="copy-btn" onClick={copyLetter}>
          Copy to Clipboard
        </button>
      </div>

      <button className="reset-btn" onClick={onReset}>
        Start Over
      </button>
    </div>
  )
}
