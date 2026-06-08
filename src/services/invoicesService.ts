import { supabase } from '@/lib/supabase'
import type { Invoice, InvoiceWorkItem, InvoicePartItem, InvoiceStatus, PublicInvoiceData } from '@/types/invoice'
import { calcInvoiceTotals } from '@/utils/invoiceCalc'

const SELECT = `*, customers(name, phone), vehicles(brand, model, license_plate, vin)`

export async function getInvoices(stoCompanyId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('sto_invoices')
    .select(SELECT)
    .eq('sto_company_id', stoCompanyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Invoice[]
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data, error } = await supabase.from('sto_invoices').select(SELECT).eq('id', id).single()
  if (error) throw error
  return data as Invoice
}

export interface InvoiceInput {
  sto_company_id: string
  customer_id: string | null
  vehicle_id: string | null
  appointment_id: string | null
  work_items: InvoiceWorkItem[]
  part_items: InvoicePartItem[]
  parts_markup_pct: number
  note?: string | null
  status?: InvoiceStatus
  created_by?: string | null
}

function buildPayload(input: InvoiceInput) {
  const t = calcInvoiceTotals(input.work_items, input.part_items, input.parts_markup_pct)
  return {
    sto_company_id: input.sto_company_id,
    customer_id: input.customer_id,
    vehicle_id: input.vehicle_id,
    appointment_id: input.appointment_id,
    work_items: input.work_items,
    part_items: input.part_items,
    parts_markup_pct: input.parts_markup_pct,
    total_work: t.total_work,
    total_parts_base: t.total_parts_base,
    total_parts: t.total_parts,
    total: t.total,
    note: input.note ?? null,
    status: input.status ?? 'issued',
  }
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  // Номер счёта — через RPC, с fallback
  let invoice_number = `СЧ-${Date.now().toString().slice(-6)}`
  const { data: num, error: numErr } = await supabase.rpc('generate_invoice_number', { p_company_id: input.sto_company_id })
  if (!numErr && num) invoice_number = num as string

  const { data, error } = await supabase
    .from('sto_invoices')
    .insert({ ...buildPayload(input), invoice_number, created_by: input.created_by ?? null })
    .select(SELECT)
    .single()
  if (error) throw error
  return data as Invoice
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<Invoice> {
  const { data, error } = await supabase
    .from('sto_invoices')
    .update({ ...buildPayload(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return data as Invoice
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const { error } = await supabase.from('sto_invoices').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('sto_invoices').delete().eq('id', id)
  if (error) throw error
}

export async function getPublicInvoice(token: string): Promise<PublicInvoiceData | null> {
  const { data, error } = await supabase.rpc('get_public_invoice', { p_token: token })
  if (error) throw error
  return (data ?? null) as PublicInvoiceData | null
}
