import { describe, it, expect } from 'vitest'
import { calcInvoiceTotals } from './invoiceCalc'
import type { InvoiceWorkItem, InvoicePartItem } from '@/types/invoice'

const work = (total: number): InvoiceWorkItem => ({ name: 'w', quantity: 1, price: total, total })
const part = (total: number): InvoicePartItem => ({ name: 'p', quantity: 1, unitPrice: total, total })

describe('calcInvoiceTotals', () => {
  it('суммирует работы и запчасти без наценки', () => {
    const t = calcInvoiceTotals([work(600), work(400)], [part(1000), part(500)], 0)
    expect(t.total_work).toBe(1000)
    expect(t.total_parts_base).toBe(1500)
    expect(t.total_parts).toBe(1500)
    expect(t.parts_markup_amount).toBe(0)
    expect(t.total).toBe(2500)
  })

  it('применяет наценку только к запчастям', () => {
    const t = calcInvoiceTotals([work(1000)], [part(1000), part(500)], 20)
    expect(t.total_parts_base).toBe(1500)
    expect(t.total_parts).toBe(1800)        // 1500 * 1.2
    expect(t.parts_markup_amount).toBe(300)
    expect(t.total).toBe(2800)              // работы 1000 + запчасти 1800
  })

  it('корректно обрабатывает пустые позиции', () => {
    const t = calcInvoiceTotals([], [], 50)
    expect(t.total).toBe(0)
    expect(t.total_parts).toBe(0)
  })
})
