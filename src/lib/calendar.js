// Generates an .ics calendar file for the appeal deadline and triggers a download.
// No auth, no backend — works on iPhone, Android, and desktop.

export function downloadAppealReminder({ deadline, insurerName, claimNumber, denialReason }) {
  if (!deadline) return

  const uid = `appeal-${Date.now()}@patientadvocate`
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  // deadline is ISO date string: YYYY-MM-DD
  const [year, month, day] = deadline.split('-')
  const dateStr = `${year}${month}${day}`

  // End date = day after (all-day event convention)
  const endDate = new Date(Number(year), Number(month) - 1, Number(day) + 1)
  const endStr = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`

  const summary = `Insurance Appeal Deadline${insurerName ? ` — ${insurerName}` : ''}`
  const description = [
    claimNumber ? `Claim: ${claimNumber}` : '',
    denialReason ? `Denial: ${denialReason}` : '',
    'Review your appeal letters in the Patient Advocate app.',
    `https://ruskracing.com/PatientAdvocate`,
  ].filter(Boolean).join('\\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Patient Advocate//PatientAdvocate//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${endStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    // 14-day reminder
    'BEGIN:VALARM',
    'TRIGGER:-P14D',
    'ACTION:DISPLAY',
    'DESCRIPTION:14 days until your insurance appeal deadline',
    'END:VALARM',
    // 7-day reminder
    'BEGIN:VALARM',
    'TRIGGER:-P7D',
    'ACTION:DISPLAY',
    'DESCRIPTION:7 days until your insurance appeal deadline',
    'END:VALARM',
    // 3-day reminder
    'BEGIN:VALARM',
    'TRIGGER:-P3D',
    'ACTION:DISPLAY',
    'DESCRIPTION:3 days until your insurance appeal deadline',
    'END:VALARM',
    // Day-of reminder
    'BEGIN:VALARM',
    'TRIGGER:PT8H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Your insurance appeal deadline is TODAY',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'appeal-deadline.ics'
  a.click()
  URL.revokeObjectURL(url)
}
