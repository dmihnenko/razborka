import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, User, Car, FileText, Wrench, Package, Calendar } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import ClientSelector from '@/components/appointments/ClientSelector'
import { fmtMoney } from '@/utils/money'
import { calcInvoiceTotals } from '@/utils/invoiceCalc'
import { createInvoice, updateInvoice, getInvoice } from '@/services/invoicesService'
import { fetchCustomerAppointments } from '@/services/customersService'
import type { InvoiceWorkItem, InvoicePartItem } from '@/types/invoice'

const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
function fmtAppt(s: string) {
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
const num = (v: any) => Number(v) || 0

export default function InvoiceBuilder() {
  const { invoiceId } = useParams()
  const isEdit = !!invoiceId
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const { data: profile } = useUserProfile()

  const [customerId, setCustomerId] = useState('')
  const [customer, setCustomer] = useState<any>(null)
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [vehicleLabel, setVehicleLabel] = useState('')
  const [workItems, setWorkItems] = useState<InvoiceWorkItem[]>([])
  const [partItems, setPartItems] = useState<InvoicePartItem[]>([])
  const [markup, setMarkup] = useState(0)
  const [note, setNote] = useState('')

  // ── Загрузка существующего счёта (редактирование) ──
  const { data: existing } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId!),
    enabled: isEdit,
  })
  useEffect(() => {
    if (!existing) return
    setCustomerId(existing.customer_id || '')
    setCustomer(existing.customers ? { id: existing.customer_id, ...existing.customers } : null)
    setVehicleId(existing.vehicle_id)
    setAppointmentId(existing.appointment_id)
    setVehicleLabel(existing.vehicles ? `${existing.vehicles.brand} ${existing.vehicles.model}` : '')
    setWorkItems(existing.work_items || [])
    setPartItems(existing.part_items || [])
    setMarkup(existing.parts_markup_pct || 0)
    setNote(existing.note || '')
  }, [existing])

  // ── Заявки выбранного клиента ──
  const { data: appointments = [] } = useQuery({
    queryKey: ['customer-appointments', customerId],
    queryFn: () => fetchCustomerAppointments(customerId),
    enabled: !!customerId && !isEdit,
  })

  // Префилл по ?appointment= (шорткат со страницы заявки)
  const prefillApptId = searchParams.get('appointment')
  const { data: prefillAppt } = useQuery({
    queryKey: ['prefill-appointment', prefillApptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(name, phone), vehicles(brand, model, license_plate, vin)')
        .eq('id', prefillApptId).single()
      if (error) throw error
      return data
    },
    enabled: !!prefillApptId && !isEdit,
  })
  useEffect(() => {
    if (prefillAppt && !customerId) {
      setCustomerId(prefillAppt.customer_id)
      setCustomer(prefillAppt.customers ? { id: prefillAppt.customer_id, ...prefillAppt.customers } : null)
      pickAppointment(prefillAppt)
    }
  }, [prefillAppt]) // eslint-disable-line react-hooks/exhaustive-deps

  function pickAppointment(appt: any) {
    setAppointmentId(appt.id)
    setVehicleId(appt.vehicle_id)
    setVehicleLabel(appt.vehicles ? `${appt.vehicles.brand} ${appt.vehicles.model}` : '')
    setWorkItems((appt.work_items || []).map((w: any) => ({
      name: w.name, quantity: 1, price: num(w.price), total: num(w.price),
    })))
    setPartItems((appt.part_items || []).map((p: any) => {
      const q = num(p.quantity) || 1
      const unit = num(p.price)
      return { name: p.name, quantity: q, unitPrice: unit, total: q * unit }
    }))
  }

  // ── Итоги ──
  const totals = useMemo(() => calcInvoiceTotals(workItems, partItems, markup), [workItems, partItems, markup])

  // ── Сохранение ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = {
        sto_company_id: profile!.sto_company_id!,
        customer_id: customerId || null,
        vehicle_id: vehicleId,
        appointment_id: appointmentId,
        work_items: workItems,
        part_items: partItems,
        parts_markup_pct: markup,
        note: note || null,
        created_by: profile?.id ?? null,
      }
      return isEdit ? updateInvoice(invoiceId!, input) : createInvoice(input)
    },
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      toast.success(isEdit ? 'Счёт обновлён' : 'Счёт создан')
      navigate(`/sto/invoices/${inv.id}`)
    },
    onError: (e: any) => toast.error(e?.message || 'Ошибка сохранения'),
  })

  const canSave = !!customerId && (workItems.length > 0 || partItems.length > 0) && !!profile?.sto_company_id

  // ── Хелперы редактирования позиций ──
  const updWork = (i: number, patch: Partial<InvoiceWorkItem>) => setWorkItems(items => items.map((w, idx) => {
    if (idx !== i) return w
    const next = { ...w, ...patch }
    next.total = num(next.quantity) * num(next.price)
    return next
  }))
  const updPart = (i: number, patch: Partial<InvoicePartItem>) => setPartItems(items => items.map((p, idx) => {
    if (idx !== i) return p
    const next = { ...p, ...patch }
    next.total = num(next.quantity) * num(next.unitPrice)
    return next
  }))

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-3 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 text-base flex-1">{isEdit ? 'Редактирование счёта' : 'Новый счёт'}</h1>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            className="btn-primary btn-sm"
          >
            {saveMutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="w-full px-3 sm:px-6 py-5 space-y-4 max-w-4xl mx-auto">

        {/* Клиент */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Клиент</h2>
            {customer && <span className="text-sm text-gray-500">· {customer.name}</span>}
          </div>
          <ClientSelector
            selectedId={customerId}
            onSelect={(id, c) => { setCustomerId(id); setCustomer(c); setAppointmentId(null) }}
          />
        </div>

        {/* Заявка клиента */}
        {customerId && !isEdit && (
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900">Заявка</h2>
              <span className="text-xs text-gray-400">позиции подтянутся из заявки</span>
            </div>
            {appointments.length === 0 ? (
              <p className="text-sm text-gray-400">У клиента нет заявок — добавьте позиции вручную ниже.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {appointments.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => pickAppointment(a)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${appointmentId === a.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{fmtAppt(a.scheduled_date)}</span>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtMoney(a.total_cost || (num(a.total_work_cost) + num(a.total_parts_cost)))}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.vehicles ? `${a.vehicles.brand} ${a.vehicles.model}` : '—'} · #{a.id.slice(-6).toUpperCase()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Авто (инфо) */}
        {vehicleLabel && (
          <div className="card p-4 flex items-center gap-2 text-sm">
            <Car className="w-4 h-4 text-gray-400" /><span className="text-gray-500">Автомобиль:</span>
            <span className="font-semibold text-gray-900">{vehicleLabel}</span>
          </div>
        )}

        {/* Работы */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Wrench className="w-4 h-4 text-violet-500" /><h2 className="text-sm font-bold text-gray-900">Работы</h2></div>
            <button onClick={() => setWorkItems(i => [...i, { name: '', quantity: 1, price: 0, total: 0 }])} className="btn-ghost btn-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Добавить
            </button>
          </div>
          {workItems.length === 0 ? (
            <p className="text-sm text-gray-400">Нет работ</p>
          ) : (
            <div className="space-y-2">
              {workItems.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={w.name} onChange={e => updWork(i, { name: e.target.value })} placeholder="Наименование" className="form-input flex-1" />
                  <input type="number" min="1" value={w.quantity} onChange={e => updWork(i, { quantity: num(e.target.value) })} className="form-input w-16 text-center" />
                  <input type="number" min="0" value={w.price} onChange={e => updWork(i, { price: num(e.target.value) })} className="form-input w-28 text-right" />
                  <span className="w-24 text-right text-sm font-semibold tabular-nums">{fmtMoney(w.total)}</span>
                  <button onClick={() => setWorkItems(items => items.filter((_, idx) => idx !== i))} className="btn-icon-sm text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Запчасти */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Package className="w-4 h-4 text-emerald-500" /><h2 className="text-sm font-bold text-gray-900">Запчасти</h2></div>
            <button onClick={() => setPartItems(i => [...i, { name: '', quantity: 1, unitPrice: 0, total: 0 }])} className="btn-ghost btn-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Добавить
            </button>
          </div>
          {partItems.length === 0 ? (
            <p className="text-sm text-gray-400">Нет запчастей</p>
          ) : (
            <div className="space-y-2">
              {partItems.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={p.name} onChange={e => updPart(i, { name: e.target.value })} placeholder="Наименование" className="form-input flex-1" />
                  <input type="number" min="1" value={p.quantity} onChange={e => updPart(i, { quantity: num(e.target.value) })} className="form-input w-16 text-center" />
                  <input type="number" min="0" value={p.unitPrice} onChange={e => updPart(i, { unitPrice: num(e.target.value) })} className="form-input w-28 text-right" />
                  <span className="w-24 text-right text-sm font-semibold tabular-nums">{fmtMoney(p.total)}</span>
                  <button onClick={() => setPartItems(items => items.filter((_, idx) => idx !== i))} className="btn-icon-sm text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Наценка */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
            <span className="text-sm text-gray-600">Наценка на запчасти, %</span>
            <input type="number" min="0" value={markup} onChange={e => setMarkup(num(e.target.value))} className="form-input w-24 text-center" />
            {markup > 0 && partItems.length > 0 && (
              <span className="text-xs text-gray-400">база {fmtMoney(totals.total_parts_base)} → {fmtMoney(totals.total_parts)}</span>
            )}
          </div>
        </div>

        {/* Примечание */}
        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-gray-400" /> Примечание</h2>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="form-input resize-none" placeholder="Необязательно" />
        </div>

        {/* Итог */}
        <div className="card p-4 sm:p-5 flex items-center justify-between">
          <div className="text-sm text-gray-500 space-y-0.5">
            <p>Работы: <span className="font-semibold text-gray-700">{fmtMoney(totals.total_work)}</span></p>
            <p>Запчасти: <span className="font-semibold text-gray-700">{fmtMoney(totals.total_parts)}</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Итого</p>
            <p className="text-2xl font-bold text-primary tabular-nums">{fmtMoney(totals.total)}</p>
          </div>
        </div>

        {!profile && <div className="flex justify-center py-6"><Spinner /></div>}
      </div>
    </div>
  )
}
