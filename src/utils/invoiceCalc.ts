import type { InvoiceWorkItem, InvoicePartItem } from '@/types/invoice'

export interface InvoiceTotals {
  total_work: number
  total_parts_base: number
  total_parts: number      // после наценки
  parts_markup_amount: number
  total: number
}

export function calcInvoiceTotals(
  workItems: InvoiceWorkItem[],
  partItems: InvoicePartItem[],
  partsMarkupPct: number,
): InvoiceTotals {
  const total_work = workItems.reduce((s, w) => s + (Number(w.total) || 0), 0)
  const total_parts_base = partItems.reduce((s, p) => s + (Number(p.total) || 0), 0)
  const pct = Number(partsMarkupPct) || 0
  const total_parts = Math.round(total_parts_base * (1 + pct / 100))
  const parts_markup_amount = total_parts - total_parts_base
  const total = total_work + total_parts
  return { total_work, total_parts_base, total_parts, parts_markup_amount, total }
}
