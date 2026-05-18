import { describe, it, expect } from 'vitest'
import { parseMarkdown, lookupVerifiedFacts } from './index'

const sampleMarkdown = `---
title: "Test Title"
summary: "Test summary sentence."
source: "Test Source Manual, Sec. 1.1"
updated: 2026
---

## Test Content

This is the body of the document.`

const emptyMarkdown = `No frontmatter here, just body text.`

describe('parseMarkdown', () => {
  it('extracts frontmatter fields from valid markdown', () => {
    const { meta, body } = parseMarkdown(sampleMarkdown)
    expect(meta.title).toBe('Test Title')
    expect(meta.summary).toBe('Test summary sentence.')
    expect(meta.source).toBe('Test Source Manual, Sec. 1.1')
    expect(meta.updated).toBe('2026')
  })

  it('returns body content separately from frontmatter', () => {
    const { body } = parseMarkdown(sampleMarkdown)
    expect(body).toContain('This is the body of the document.')
    expect(body).not.toContain('title:')
  })

  it('returns empty meta and raw text when no frontmatter', () => {
    const { meta, body } = parseMarkdown(emptyMarkdown)
    expect(meta).toEqual({})
    expect(body).toBe(emptyMarkdown)
  })
})

describe('lookupVerifiedFacts', () => {
  const mockFiles = {
    './medicare_advantage/medical_necessity.md': sampleMarkdown,
    './employer_erisa/medical_necessity.md': sampleMarkdown,
    './medicare_advantage/co.md': `---
title: "Colorado Rules"
summary: "Colorado state rules."
source: "Colorado Insurance Code"
updated: 2026
---
Colorado specific content.`,
  }

  it('returns silentContext and visibleCitations for a matched file', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'medicare_advantage', denial_reason: 'medical_necessity', state: null },
      mockFiles
    )
    expect(result.silentContext).toContain('This is the body of the document.')
    expect(result.visibleCitations).toHaveLength(1)
    expect(result.visibleCitations[0].title).toBe('Test Title')
    expect(result.visibleCitations[0].summary).toBe('Test summary sentence.')
  })

  it('appends state-specific content when state file exists', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'medicare_advantage', denial_reason: 'medical_necessity', state: 'co' },
      mockFiles
    )
    expect(result.silentContext).toContain('Colorado specific content.')
    expect(result.visibleCitations).toHaveLength(2)
    expect(result.visibleCitations[1].title).toBe('Colorado Rules')
  })

  it('returns empty results when no file matches', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'medicaid', denial_reason: 'medical_necessity', state: null },
      mockFiles
    )
    expect(result.silentContext).toBe('')
    expect(result.visibleCitations).toEqual([])
  })

  it('returns empty results when plan_type is unclear', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'unclear', denial_reason: 'medical_necessity', state: null },
      mockFiles
    )
    expect(result.silentContext).toBe('')
    expect(result.visibleCitations).toEqual([])
  })

  it('returns empty results when plan_type is null', () => {
    const result = lookupVerifiedFacts(
      { plan_type: null, denial_reason: 'medical_necessity', state: null },
      mockFiles
    )
    expect(result.silentContext).toBe('')
    expect(result.visibleCitations).toEqual([])
  })

  it('includes primary match even when state file is missing', () => {
    const result = lookupVerifiedFacts(
      { plan_type: 'medicare_advantage', denial_reason: 'medical_necessity', state: 'ak' },
      mockFiles
    )
    expect(result.visibleCitations).toHaveLength(1)
    expect(result.silentContext).toContain('This is the body of the document.')
  })
})
