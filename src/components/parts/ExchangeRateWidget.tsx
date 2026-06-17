import { useState } from 'react'
import { DollarSign, RefreshCw, Pencil, Check, X } from 'lucide-react'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { toast } from 'sonner'

/**
 * Компактное напоминание обновить курс доллара.
 * Показывается ТОЛЬКО когда курс не на сегодня И уже утро (≥9:00).
 * После обновления (курс становится «сегодняшним») — скрывается до следующего дня.
 */
export default function ExchangeRateWidget() {
  const { rate, isStale, fetching, fetchPrivatBank, setManualRate } = usePartsExchangeRate()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  const needUpdate = isStale && new Date().getHours() >= 9
  if (!needUpdate) return null

  const fetchNow = async () => {
    try {
      const r = await fetchPrivatBank()
      toast.success(`Курс обновлён: ${r.toFixed(2)} ₴/$`)
    } catch {
      toast.error('Не удалось получить курс ПриватБанка')
    }
  }

  const saveManual = () => {
    const v = parseFloat(val.replace(',', '.'))
    if (!v || v <= 0) { toast.error('Введите корректный курс'); return }
    setManualRate(v)
    toast.success('Курс сохранён')
  }

  return (
    <div className="cab-card p-3 flex items-center gap-3" style={{ borderColor: 'var(--cab-signal)' }}>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--cab-signal-weak)', color: 'var(--cab-signal)' }}>
        <DollarSign className="w-5 h-5" strokeWidth={1.5} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight" style={{ color: 'var(--cab-ink)' }}>Обновите курс доллара</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--cab-ink-2)' }}>
          Сейчас {rate.toFixed(2)} ₴/$ · нужен для верной окупаемости
        </p>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveManual()}
            autoFocus
            inputMode="decimal"
            placeholder={rate.toFixed(2)}
            className="form-input !h-8 w-20 tabular-nums"
          />
          <button onClick={saveManual} className="cab-btn cab-btn-primary cab-btn-sm" title="Сохранить">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setEditing(false); setVal('') }} className="cab-btn cab-btn-ghost cab-btn-sm" title="Отмена">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={fetchNow} disabled={fetching} className="cab-btn cab-btn-signal cab-btn-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Обновить</span>
          </button>
          <button onClick={() => { setEditing(true); setVal(rate.toFixed(2)) }} title="Ввести вручную"
            className="cab-btn cab-btn-ghost cab-btn-sm">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
