import { fmtMoney } from '@/utils/money'
import type { Invoice } from '@/types/invoice'

interface Party { name?: string | null; phone?: string | null; address?: string | null; email?: string | null }
interface Veh { brand?: string | null; model?: string | null; license_plate?: string | null; vin?: string | null }

interface Props {
  invoice: Invoice
  company?: Party | null
  customer?: Party | null
  vehicle?: Veh | null
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft:  { label: 'Черновик', cls: 'bg-gray-100 text-gray-600' },
  issued: { label: 'Выставлен', cls: 'bg-blue-100 text-blue-700' },
  paid:   { label: 'Оплачен',  cls: 'bg-green-100 text-green-700' },
}

function fmtDate(s?: string | null) {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function InvoiceDocument({ invoice, company, customer, vehicle }: Props) {
  const markup = invoice.total_parts - invoice.total_parts_base
  const st = STATUS_LABEL[invoice.status] ?? STATUS_LABEL.issued
  const apptShort = invoice.appointment_id ? `#${invoice.appointment_id.slice(-6).toUpperCase()}` : null

  return (
    <div className="print-area bg-white text-gray-900 rounded-2xl border border-gray-100 shadow-sm mx-auto w-full max-w-3xl p-6 sm:p-10">

      {/* ── Шапка ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b-2 border-gray-900">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{company?.name || 'СТО'}</h1>
          <div className="mt-1 text-xs text-gray-500 space-y-0.5">
            {company?.address && <p>{company.address}</p>}
            {company?.phone && <p>тел. {company.phone}</p>}
            {company?.email && <p>{company.email}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg sm:text-xl font-bold">Счёт № {invoice.invoice_number || '—'}</p>
          <p className="text-sm text-gray-500">от {fmtDate(invoice.issued_at)}</p>
          <span className={`inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
        </div>
      </div>

      {/* ── Стороны ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Клиент</p>
          <p className="font-semibold">{customer?.name || '—'}</p>
          {customer?.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Автомобиль</p>
          <p className="font-semibold">{vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || '—' : '—'}</p>
          <div className="text-sm text-gray-600 flex flex-wrap gap-x-3">
            {vehicle?.license_plate && <span className="font-mono">{vehicle.license_plate}</span>}
            {vehicle?.vin && <span>VIN: {vehicle.vin}</span>}
          </div>
          {apptShort && <p className="text-xs text-gray-400 mt-1">Заявка {apptShort}</p>}
        </div>
      </div>

      {/* ── Работы ──────────────────────────────────────────────── */}
      {invoice.work_items.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-bold mb-2">Работы</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-200">
                <th className="py-1.5 font-semibold">Наименование</th>
                <th className="py-1.5 font-semibold text-center w-16">Кол-во</th>
                <th className="py-1.5 font-semibold text-right w-28">Цена</th>
                <th className="py-1.5 font-semibold text-right w-28">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {invoice.work_items.map((w, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5">{w.name}</td>
                  <td className="py-1.5 text-center tabular-nums">{w.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(w.price)}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{fmtMoney(w.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end mt-1.5 text-sm">
            <span className="text-gray-500 mr-3">Итого работы:</span>
            <span className="font-bold tabular-nums">{fmtMoney(invoice.total_work)}</span>
          </div>
        </div>
      )}

      {/* ── Запчасти ────────────────────────────────────────────── */}
      {invoice.part_items.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-bold mb-2">Запчасти</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-200">
                <th className="py-1.5 font-semibold">Наименование</th>
                <th className="py-1.5 font-semibold text-center w-16">Кол-во</th>
                <th className="py-1.5 font-semibold text-right w-28">Цена</th>
                <th className="py-1.5 font-semibold text-right w-28">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {invoice.part_items.map((p, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 text-center tabular-nums">{p.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(p.unitPrice)}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{fmtMoney(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col items-end gap-0.5 mt-1.5 text-sm">
            <div className="flex"><span className="text-gray-500 mr-3">Запчасти (база):</span><span className="tabular-nums">{fmtMoney(invoice.total_parts_base)}</span></div>
            {invoice.parts_markup_pct > 0 && (
              <div className="flex"><span className="text-gray-500 mr-3">Наценка {invoice.parts_markup_pct}%:</span><span className="tabular-nums">+{fmtMoney(markup)}</span></div>
            )}
            <div className="flex"><span className="text-gray-500 mr-3">Итого запчасти:</span><span className="font-bold tabular-nums">{fmtMoney(invoice.total_parts)}</span></div>
          </div>
        </div>
      )}

      {/* ── Итог ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t-2 border-gray-900">
        <span className="text-base font-bold">ИТОГО К ОПЛАТЕ</span>
        <span className="text-2xl font-extrabold tabular-nums">{fmtMoney(invoice.total)}</span>
      </div>

      {invoice.note && (
        <p className="mt-4 text-sm text-gray-500 whitespace-pre-line"><span className="font-semibold text-gray-700">Примечание: </span>{invoice.note}</p>
      )}
    </div>
  )
}
