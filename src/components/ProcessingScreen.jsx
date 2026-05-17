export default function ProcessingScreen({ photoUrl }) {
  return (
    <div className="screen processing-screen">
      <img src={photoUrl} alt="Your denial letter" className="photo-thumbnail" />
      <div className="spinner" />
      <p className="processing-msg">Reading your denial letter…</p>
      <p className="processing-submsg">Building your appeal…</p>
    </div>
  )
}
