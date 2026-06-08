export interface InvoiceWorkItem {
  name: string
  quantity: number
  price: number       // цена за единицу
  total: number       // quantity * price
}

export interface InvoicePartItem {
  name: string
  quantity: number
  unitPrice: number   // цена за единицу (база, до наценки)
  total: number       // quantity * unitPrice (база)
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid'

export interface Invoice {
  id: string
  sto_company_id: string
  invoice_number: string | null
  customer_id: string | null
  vehicle_id: string | null
  appointment_id: string | null
  issued_at: string
  work_items: InvoiceWorkItem[]
  part_items: InvoicePartItem[]
  parts_markup_pct: number
  total_work: number
  total_parts_base: number
  total_parts: number
  total: number
  note: string | null
  status: InvoiceStatus
  public_token: string
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  customers?: { name: string; phone: string | null } | null
  vehicles?: { brand: string; model: string; license_plate: string | null; vin?: string | null } | null
}

/** Данные для публичной страницы (RPC get_public_invoice) */
export interface PublicInvoiceData {
  invoice: Invoice
  company: { name: string; phone: string | null; address: string | null; email: string | null } | null
  customer: { name: string; phone: string | null } | null
  vehicle: { brand: string; model: string; license_plate: string | null; vin: string | null } | null
}
