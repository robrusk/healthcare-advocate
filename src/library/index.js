// Eagerly bundle all library markdown files at build time.
// Uses Vite's import.meta.glob — no runtime network requests, works fully offline.
const LIBRARY_FILES = import.meta.glob('./**/*.md', { eager: true, query: '?raw', import: 'default' })

export function parseMarkdown(rawText) {
  const match = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: rawText }

  const meta = {}
  match[1].split('\n').forEach((line) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) return
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key) meta[key] = value
  })

  return { meta, body: match[2] }
}

// Accepts an optional _files override so tests can inject a mock file map
// without needing to mock import.meta.glob.
export function lookupVerifiedFacts({ plan_type, denial_reason, state }, _files = LIBRARY_FILES) {
  let silentContext = ''
  const visibleCitations = []

  if (!plan_type || plan_type === 'unclear') return { silentContext, visibleCitations }

  const primaryPath = `./${plan_type}/${denial_reason}.md`
  if (_files[primaryPath]) {
    const { meta, body } = parseMarkdown(_files[primaryPath])
    silentContext += `PRIMARY GROUNDING FACTS:\n${body}\n\n`
    visibleCitations.push({
      title: meta.title || `${denial_reason} Guidelines`,
      summary: meta.summary || 'Verified regulatory rules for this denial type.',
      source: meta.source || 'Official Guidelines',
      updated: meta.updated || '2026',
    })
  }

  if (state) {
    const statePath = `./${plan_type}/${state.toLowerCase()}.md`
    if (_files[statePath]) {
      const { meta, body } = parseMarkdown(_files[statePath])
      silentContext += `STATE-SPECIFIC RULES (${state.toUpperCase()}):\n${body}`
      visibleCitations.push({
        title: meta.title || `${state.toUpperCase()} State Rules`,
        summary: meta.summary || `State protections for ${state.toUpperCase()}.`,
        source: meta.source || 'State Statutes',
        updated: meta.updated || '2026',
      })
    }
  }

  return { silentContext: silentContext.trim(), visibleCitations }
}
