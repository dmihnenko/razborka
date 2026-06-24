import { describe, it, expect } from 'vitest'
import {
  getPartsOrderStatusColor,
  getPartsOrderStatusText,
  type PartsOrderStatus,
} from '@/utils/status'

describe('getPartsOrderStatusColor', () => {
  const cases: Array<[PartsOrderStatus, string]> = [
    ['new', 'blue'],
    ['assembling', 'amber'],
    ['shipped', 'indigo'],
    ['completed', 'green'],
    ['cancelled', 'red'],
  ]

  cases.forEach(([status, colorHint]) => {
    it(`статус "${status}" содержит цвет "${colorHint}"`, () => {
      expect(getPartsOrderStatusColor(status)).toContain(colorHint)
    })
  })
})

describe('getPartsOrderStatusText', () => {
  it('"new" → "Новый"', () => {
    expect(getPartsOrderStatusText('new')).toBe('Новый')
  })
  it('"assembling" → "Сборка"', () => {
    expect(getPartsOrderStatusText('assembling')).toBe('Сборка')
  })
  it('"shipped" → "Отправлен"', () => {
    expect(getPartsOrderStatusText('shipped')).toBe('Отправлен')
  })
  it('"completed" → "Завершён"', () => {
    expect(getPartsOrderStatusText('completed')).toBe('Завершён')
  })
  it('"cancelled" → "Отменён"', () => {
    expect(getPartsOrderStatusText('cancelled')).toBe('Отменён')
  })
})
