import { describe, it, expect } from 'vitest'
import { encodeWithinBudget, PHOTO_VARIANTS } from './imageOptimize'
// @ts-expect-error JS-модуль воркера без типов
import { LIMITS } from '../../worker/photoStorage.js'

/** Кодер-заглушка: вес файла пропорционален качеству. */
function fakeEncoder(bytesPerQuality: number) {
  const calls: number[] = []
  const encode = async (q: number) => {
    calls.push(q)
    return new Blob([new Uint8Array(Math.round(q * bytesPerQuality))])
  }
  return { encode, calls }
}

describe('encodeWithinBudget', () => {
  it('сразу укладывается в бюджет — одно кодирование', async () => {
    const { encode, calls } = fakeEncoder(1000)
    const blob = await encodeWithinBudget(encode, { budget: 900, startQuality: 0.8, minQuality: 0.5 })
    expect(calls).toEqual([0.8])
    expect(blob.size).toBe(800)
  })

  it('снижает качество, пока файл не уложится в бюджет', async () => {
    const { encode, calls } = fakeEncoder(1000)
    const blob = await encodeWithinBudget(encode, { budget: 700, startQuality: 0.8, minQuality: 0.5 })
    expect(calls).toEqual([0.8, 0.73, 0.66])
    expect(blob.size).toBeLessThanOrEqual(700)
  })

  it('не опускается ниже минимального качества и отдаёт самый лёгкий вариант', async () => {
    const { encode, calls } = fakeEncoder(1000)
    const blob = await encodeWithinBudget(encode, { budget: 100, startQuality: 0.8, minQuality: 0.6 })
    expect(Math.min(...calls)).toBe(0.6)
    expect(calls.every(q => q >= 0.6)).toBe(true)
    expect(blob.size).toBe(600)
  })

  it('размеры идут по убыванию и бюджеты разумны', () => {
    const { full, medium, thumb } = PHOTO_VARIANTS
    expect(full.maxSide).toBeGreaterThan(medium.maxSide)
    expect(medium.maxSide).toBeGreaterThan(thumb.maxSide)
    for (const v of [full, medium, thumb]) expect(v.budget).toBeLessThan(v.hardCap)
  })

  it('потолки совпадают с лимитами воркера', () => {
    expect(PHOTO_VARIANTS.full.hardCap).toBe(LIMITS.full)
    expect(PHOTO_VARIANTS.medium.hardCap).toBe(LIMITS.medium)
    expect(PHOTO_VARIANTS.thumb.hardCap).toBe(LIMITS.thumb)
  })
})
