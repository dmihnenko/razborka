import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Bell, Check } from 'lucide-react'
import type { fetchStoAlerts, TomorrowAlert } from '@/services/stoService'
import { fmtMoney } from '@/utils/money'
import NotifyClientModal from './NotifyClientModal'

type AlertsData = Awaited<ReturnType<typeof fetchStoAlerts>>

export default function StoAlerts({ data }: { data?: AlertsData | null }) {
  const navigate = useNavigate()
  const [notify, setNotify] = useState<TomorrowAlert | null>(null)

  const readyUnpaid = data?.readyUnpaid ?? []
  const tomorrow = data?.tomorrow ?? []
  if (readyUnpaid.length === 0 && tomorrow.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Готовы — требуют счёта/оплаты */}
        {readyUnpaid.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 flex-1">Требуют счёта и оплаты</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{readyUnpaid.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {readyUnpaid.map(a => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/sto/appointments/${a.id}`)}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">{a.customerName}</span>
                  <span className="text-xs text-gray-500 tabular-nums">{fmtMoney(a.total)}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${a.hasInvoice ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                    {a.hasInvoice ? 'не оплачен' : 'нет счёта'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Записи на завтра — напомнить клиентам */}
        {tomorrow.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <CalendarClock className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 flex-1">Напомните клиентам</h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{tomorrow.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {tomorrow.map(a => (
                <div key={a.id} className="flex items-center gap-2 px-4 py-2.5">
                  <button onClick={() => navigate(`/sto/appointments/${a.id}`)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      <span className="text-[11px] font-bold text-blue-700 mr-1.5">{a.dateLabel}{a.time ? ` ${a.time}` : ''}</span>
                      {a.customerName}
                    </p>
                    {a.vehicle && <p className="text-xs text-gray-500 truncate">{a.vehicle}</p>}
                  </button>
                  {a.remindedAt ? (
                    <button
                      onClick={() => setNotify(a)}
                      className="text-[11px] font-semibold px-2 py-1 rounded-md bg-green-50 text-green-700 whitespace-nowrap inline-flex items-center gap-1"
                      title="Напоминание отправлено — отправить снова"
                    >
                      <Check className="w-3.5 h-3.5" /> Отправлено
                    </button>
                  ) : (
                    <button
                      onClick={() => setNotify(a)}
                      className="btn-secondary btn-sm inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Bell className="w-3.5 h-3.5" /> Оповестить
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {notify && (
        <NotifyClientModal
          appointmentId={notify.id}
          customerName={notify.customerName}
          phone={notify.phone}
          onClose={() => setNotify(null)}
        />
      )}
    </>
  )
}
