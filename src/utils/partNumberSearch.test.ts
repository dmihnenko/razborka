import { describe, it, expect } from 'vitest'
import { normalizePartNumber, oemSearchTerm, oemOrClause } from './partNumberSearch'

describe('partNumberSearch', () => {
  it('убирает разделители и регистр', () => {
    expect(normalizePartNumber('1k0 615-301.aa')).toBe('1K0615301AA')
    expect(normalizePartNumber('1K0/615 301 AA')).toBe('1K0615301AA')
  })
  it('приводит кириллические двойники к латинице', () => {
    expect(normalizePartNumber('1K0615301АА')).toBe('1K0615301AA')
    expect(normalizePartNumber('вмw 123')).toBe('BMW123')
  })
  it('oemSearchTerm требует цифру и длину от 4', () => {
    expect(oemSearchTerm('1K0 615 301 AA')).toBe('1K0615301AA')
    expect(oemSearchTerm('бампер')).toBeNull()
    expect(oemSearchTerm('a12')).toBeNull()
    expect(oemSearchTerm('12 34')).toBe('1234')
  })
  it('oemOrClause безопасен для or()', () => {
    expect(oemOrClause('1K0,615(301)%AA')).toBe(',part_number_norm.ilike.%1K0615301AA%')
    expect(oemOrClause('фара')).toBe('')
  })
})
