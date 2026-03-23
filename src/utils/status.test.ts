import { describe, it, expect } from 'vitest'
import {
  getAppointmentStatusColor,
  getAppointmentStatusText,
  getPartsOrderStatusColor,
  getPartsOrderStatusText,
  getStatusColor,
  getStatusText,
  type AppointmentStatus,
  type PartsOrderStatus,
} from '@/utils/status'

describe('getAppointmentStatusColor', () => {
  const cases: Array<[AppointmentStatus, string]> = [
    ['pending', 'yellow'],
    ['scheduled', 'blue'],
    ['in_progress', 'blue'],
    ['completed', 'green'],
    ['cancelled', 'red'],
    ['archived', 'gray'],
  ]

  cases.forEach(([status, colorHint]) => {
    it(`статус "${status}" содержит цвет "${colorHint}"`, () => {
      expect(getAppointmentStatusColor(status)).toContain(colorHint)
    })
  })

  it('неизвестный статус возвращает серый цвет по умолчанию', () => {
    expect(getAppointmentStatusColor('unknown' as AppointmentStatus)).toContain('gray')
  })
})

describe('getAppointmentStatusText', () => {
  it('"pending" → "Ожидает"', () => {
    expect(getAppointmentStatusText('pending')).toBe('Ожидает')
  })
  it('"scheduled" → "Запланировано"', () => {
    expect(getAppointmentStatusText('scheduled')).toBe('Запланировано')
  })
  it('"in_progress" → "В работе"', () => {
    expect(getAppointmentStatusText('in_progress')).toBe('В работе')
  })
  it('"completed" → "Завершено"', () => {
    expect(getAppointmentStatusText('completed')).toBe('Завершено')
  })
  it('"cancelled" → "Отменено"', () => {
    expect(getAppointmentStatusText('cancelled')).toBe('Отменено')
  })
  it('"archived" → "Архив"', () => {
    expect(getAppointmentStatusText('archived')).toBe('Архив')
  })
  it('неизвестный статус — возвращает само значение', () => {
    expect(getAppointmentStatusText('unknown' as AppointmentStatus)).toBe('unknown')
  })
})

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

describe('getStatusColor (legacy)', () => {
  it('делегирует к getAppointmentStatusColor', () => {
    expect(getStatusColor('completed')).toBe(getAppointmentStatusColor('completed'))
  })
})

describe('getStatusText (legacy)', () => {
  it('делегирует к getAppointmentStatusText', () => {
    expect(getStatusText('pending')).toBe(getAppointmentStatusText('pending'))
  })
})
