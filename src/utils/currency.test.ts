import { describe, it, expect } from 'vitest'
import { formatCurrency, formatPrice } from '@/utils/currency'

describe('formatCurrency', () => {
  it('возвращает "—" для undefined', () => {
    expect(formatCurrency(undefined)).toBe('—')
  })

  it('возвращает "—" для null', () => {
    expect(formatCurrency(null)).toBe('—')
  })

  it('возвращает "—" для 0', () => {
    expect(formatCurrency(0)).toBe('—')
  })

  it('форматирует целое число с символом гривны', () => {
    const result = formatCurrency(1000)
    expect(result).toContain('₴')
    expect(result).toContain('1')
  })

  it('форматирует большое число', () => {
    const result = formatCurrency(50000)
    expect(result).toContain('₴')
    expect(result).toContain('50')
  })

  it('не добавляет дробную часть', () => {
    const result = formatCurrency(1500.75)
    expect(result).not.toContain('.')
  })
})

describe('formatPrice', () => {
  it('возвращает "—" для undefined', () => {
    expect(formatPrice(undefined)).toBe('—')
  })

  it('возвращает "—" для null', () => {
    expect(formatPrice(null)).toBe('—')
  })

  it('возвращает "—" для 0', () => {
    expect(formatPrice(0)).toBe('—')
  })

  it('форматирует UAH по умолчанию', () => {
    const result = formatPrice(500)
    expect(result).toContain('₴')
  })

  it('форматирует USD со знаком доллара', () => {
    const result = formatPrice(100, 'USD')
    expect(result).toContain('$')
    expect(result).not.toContain('₴')
  })

  it('форматирует позитивную UAH сумму', () => {
    const result = formatPrice(1234, 'UAH')
    expect(result).toContain('₴')
    expect(result).toContain('1')
  })

  it('форматирует USD сумму', () => {
    const result = formatPrice(99.99, 'USD')
    expect(result).toContain('$')
  })
})
