import { describe, it, expect } from 'vitest'
import {
  getPartsOrderStatusColor,
  getPartsOrderStatusText,
  type PartsOrderStatus,
} from '@/utils/status'

describe('getPartsOrderStatusColor', () => {
  const cases: Array<[PartsOrderStatus, string]> = [
    ['new', 'blue'],
    ['in_progress', 'yellow'],
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
  it('"in_progress" → "В обработке"', () => {
    expect(getPartsOrderStatusText('in_progress')).toBe('В обработке')
  })
  it('"completed" → "Выполнен"', () => {
    expect(getPartsOrderStatusText('completed')).toBe('Выполнен')
  })
  it('"cancelled" → "Отменен"', () => {
    expect(getPartsOrderStatusText('cancelled')).toBe('Отменен')
  })
})
