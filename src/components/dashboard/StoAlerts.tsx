import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FileText, Phone, CalendarClock, ChevronRight } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { fetchStoAlerts } from '@/services/stoService'
import { fmtMoney } from '@/utils/money'

export default function StoAlerts() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const stoCompanyId = profile?.sto_company_id

  const { data } = useQuery({
    queryKey: ['sto-alerts', stoCompanyId],
    queryFn: () => fetchStoAlerts(stoCompanyId!),
    enabled: !!stoCompanyId,
    staleTime: 60_000,
  })

  const readyUnpaid = data?.readyUnpaid ?? []
  const tomorrow = data?.tomorrow ?? []
  if (readyUnpaid.length === 0 && tomorrow.length === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
      {/* Готовые, требующие оплаты */}
      {readyUnpaid.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-900">Готовы, требуют оплаты ({readyUnpaid.length})</h3>
          </div>
          <div className="space-y-1.5">
            {readyUnpaid.map(a => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
                <button
                  onClick={() => navigate(`/sto/appointments/${a.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold text-gray-900 truncate">{a.customerName}</p>
                  <p className="text-xs text-gray-500 tabular-nums">{fmtMoney(a.total)}</p>
                </button>
                {a.hasInvoice ? (
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-blue-100 text-blue-700 whitespace-nowrap">Счёт не оплачен</span>
                ) : (
                  <button
                    onClick={() => navigate(`/invoices/new?appointment=${a.id}`)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-primary text-white whitespace-nowrap hover:bg-primary/90"
                  >
                    <FileText className="w-3 h-3" /> Выставить счёт
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Записи на завтра */}
      {tomorrow.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-blue-900">Записи на завтра ({tomorrow.length}) — напомните клиентам</h3>
          </div>
          <div className="space-y-1.5">
            {tomorrow.map(a => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
                <button
                  onClick={() => navigate(`/sto/appointments/${a.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {a.time && <span className="tabular-nums text-blue-700 mr-1.5">{a.time}</span>}
                    {a.customerName}
                  </p>
                  {a.vehicle && <p className="text-xs text-gray-500 truncate">{a.vehicle}</p>}
                </button>
                {a.phone ? (
                  <a
                    href={`tel:${a.phone}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-green-100 text-green-700 whitespace-nowrap hover:bg-green-200"
                  >
                    <Phone className="w-3 h-3" /> Позвонить
                  </a>
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
