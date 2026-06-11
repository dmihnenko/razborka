import { describe, it, expect } from 'vitest'
import { isCompanyActive } from './company'

describe('isCompanyActive', () => {
  it('активна, если флаг не выставлен (null)', () => {
    expect(isCompanyActive({ is_active: null })).toBe(true)
  })

  it('активна, если флаг отсутствует (undefined)', () => {
    expect(isCompanyActive({})).toBe(true)
    expect(isCompanyActive({ is_active: undefined })).toBe(true)
  })

  it('активна при is_active === true', () => {
    expect(isCompanyActive({ is_active: true })).toBe(true)
  })

  it('неактивна только при явной деактивации (is_active === false)', () => {
    expect(isCompanyActive({ is_active: false })).toBe(false)
  })
})
