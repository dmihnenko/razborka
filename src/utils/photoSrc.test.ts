import { describe, it, expect } from 'vitest'
import { photoSrc } from './photoSrc'

describe('photoSrc', () => {
  it('null/undefined как есть', () => {
    expect(photoSrc(null)).toBeNull()
    expect(photoSrc(undefined)).toBeUndefined()
  })
  it('DEV оставляет URL', () => {
    expect(photoSrc('https://i.ibb.co/a/b.jpg')).toBe('https://i.ibb.co/a/b.jpg')
  })
  it('в проде переписывает ibb', () => {
    import.meta.env.DEV = false
    expect(photoSrc('https://i.ibb.co/a/b.jpg')).toBe('/img/ibb/a/b.jpg')
    expect(photoSrc('https://other.com/a.jpg')).toBe('https://other.com/a.jpg')
    import.meta.env.DEV = true
  })
})
