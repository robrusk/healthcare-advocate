import { useState } from 'react'
import CaptureScreen from './components/CaptureScreen'
import ProcessingScreen from './components/ProcessingScreen'
import ResultsScreen from './components/ResultsScreen'
import { analyzeDenialLetter, fileToBase64 } from './lib/claude'

const STATES = { CAPTURE: 'capture', PROCESSING: 'processing', RESULTS: 'results' }

export default function App() {
  const [state, setState] = useState(STATES.CAPTURE)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [result, setResult] = useState(null)

  async function handleCapture(file) {
    const url = URL.createObjectURL(file)
    setPhotoUrl(url)
    setState(STATES.PROCESSING)

    const base64 = await fileToBase64(file)
    const data = await analyzeDenialLetter(base64, file.type)
    setResult(data)
    setState(STATES.RESULTS)
  }

  function handleReset() {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(null)
    setResult(null)
    setState(STATES.CAPTURE)
  }

  if (state === STATES.PROCESSING) return <ProcessingScreen photoUrl={photoUrl} />
  if (state === STATES.RESULTS) return <ResultsScreen result={result} onReset={handleReset} />
  return <CaptureScreen onCapture={handleCapture} />
}
