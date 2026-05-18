import { describe, it, expect } from 'vitest'
import { getRoute, buildLegalFramework } from './planRoutes'

describe('getRoute', () => {
  it('returns null for unclear', () => {
    expect(getRoute('unclear')).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(getRoute(null)).toBeNull()
    expect(getRoute(undefined)).toBeNull()
  })

  it('returns a route for employer_erisa', () => {
    const route = getRoute('employer_erisa')
    expect(route).not.toBeNull()
    expect(route.citations).toContain('ERISA § 503')
  })

  it('employer_erisa doNotCite warns against Medicare regs', () => {
    expect(getRoute('employer_erisa').doNotCite).toMatch(/Medicare/i)
  })

  it('returns a route for medicare_advantage', () => {
    const route = getRoute('medicare_advantage')
    expect(route.citations).toContain('42 C.F.R. Part 422, Subpart M')
  })

  it('medicare_advantage doNotCite warns against ERISA', () => {
    expect(getRoute('medicare_advantage').doNotCite).toMatch(/ERISA/i)
  })

  it('medicaid doNotCite warns against ERISA and Medicare', () => {
    const doNotCite = getRoute('medicaid').doNotCite
    expect(doNotCite).toMatch(/ERISA/i)
    expect(doNotCite).toMatch(/Medicare/i)
  })

  it('returns routes for all valid plan types', () => {
    const validTypes = ['employer_erisa', 'aca_marketplace', 'medicare_advantage', 'original_medicare', 'medicaid', 'fehb']
    validTypes.forEach((t) => {
      expect(getRoute(t)).not.toBeNull()
    })
  })
})

describe('buildLegalFramework', () => {
  it('returns null for unclear', () => {
    expect(buildLegalFramework('unclear')).toBeNull()
  })

  it('includes governing law and doNotCite in output', () => {
    const framework = buildLegalFramework('employer_erisa')
    expect(framework).toContain('ERISA § 503')
    expect(framework).toContain('Do NOT cite')
  })

  it('includes appeal path', () => {
    const framework = buildLegalFramework('medicare_advantage')
    expect(framework).toContain('Independent Review Entity')
  })
})
