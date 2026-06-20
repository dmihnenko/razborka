import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Car, CheckCircle2, XCircle, Plus, Clock, Eye, EyeOff, Tags } from 'lucide-react'
import {
  fetchCarModels, approveCarModel, rejectCarModel, addCarModel, setCarModelActive,
  type CarModelRow,
} from '@/services/adminService'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

const FILTER_LABELS: Record<Filter, string> = {
  pending: 'На утверждении',
  approved: 'В каталоге',
  rejected: 'Отклонённые',
  all: 'Все',
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'badge badge-yellow', label: 'Ожидает' },
  approved: { cls: 'badge badge-green', label: 'В каталоге' },
  rejected: { cls: 'badge badge-red', label: 'Отклонена' },
}

// ── Карточка заявки: правка написания + года, затем утвердить ───────────────
function PendingCard({
  row, onApprove, onReject, busy,
}: {
  row: CarModelRow
  onApprove: (make: string, model: string, yearFrom: number | null, yearTo: number | null) => void
  onReject: () => void
  busy: boolean
}) {
  const [make, setMake] = useState(row.make)
  const [model, setModel] = useState(row.model)
  const [yearFrom, setYearFrom] = useState(row.year_from ? String(row.year_from) : '')
  const [yearTo, setYearTo] = useState(row.year_to ? String(row.year_to) : '')

  const canApprove = make.trim() && model.trim()

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          Заявка от разборки · {new Date(row.created_at).toLocaleDateString('ru-RU')}
        </p>
        <span className="badge badge-yellow"><span className="status-dot status-dot-pulse bg-yellow-500" /> Ожидает</span>
      </div>

      {/* Правка написания */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Марка</label>
          <input value={make} onChange={e => setMake(e.target.value)} className="form-input" placeholder="Toyota" />
        </div>
        <div>
          <label className="form-label">Модель</label>
          <input value={model} onChange={e => setModel(e.target.value)} className="form-input" placeholder="Camry" />
        </div>
      </div>

      {/* Года выпуска (для фильтров) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Год с</label>
          <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)} className="form-input" placeholder="2017" min={1950} max={2100} />
        </div>
        <div>
          <label className="form-label">Год по</label>
          <input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)} className="form-input" placeholder="2026" min={1950} max={2100} />
        </div>
      </div>

      {/* Стандартные категории — список появится позже */}
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 flex items-center gap-2 text-xs text-gray-400">
        <Tags className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
        Стандартные категории подключим после добавления списка
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onReject} disabled={busy} className="cab-btn cab-btn-danger flex-1">
          <XCircle className="w-4 h-4" strokeWidth={1.5} /> Отклонить
        </button>
        <button
          onClick={() => onApprove(make.trim(), model.trim(), yearFrom ? Number(yearFrom) : null, yearTo ? Number(yearTo) : null)}
          disabled={!canApprove || busy}
          className="cab-btn cab-btn-success flex-1"
        >
          <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} /> Утвердить
        </button>
      </div>
    </div>
  )
}

export default function AdminCarModels() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('pending')
  const [newMake, setNewMake] = useState('')
  const [newModel, setNewModel] = useState('')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-car-models', filter],
    queryFn: () => fetchCarModels(filter),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-car-models'] })
    queryClient.invalidateQueries({ queryKey: ['market-car-catalog'] })
  }

  const approveMut = useMutation({
    mutationFn: (v: { id: string; make: string; model: string; yearFrom: number | null; yearTo: number | null }) =>
      approveCarModel({ id: v.id, make: v.make, model: v.model, yearFrom: v.yearFrom, yearTo: v.yearTo }),
    onSuccess: () => { invalidate(); toast.success('Модель в каталоге') },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })
  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectCarModel(id),
    onSuccess: () => { invalidate(); toast.success('Заявка отклонена') },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })
  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCarModelActive(id, active),
    onSuccess: () => { invalidate(); toast.success('Сохранено') },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })
  const addMut = useMutation({
    mutationFn: () => addCarModel(newMake, newModel),
    onSuccess: () => { invalidate(); setNewMake(''); setNewModel(''); toast.success('Модель добавлена') },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })

  const pending = rows.filter((r: CarModelRow) => r.status === 'pending')
  const others = rows.filter((r: CarModelRow) => r.status !== 'pending')
  const busy = approveMut.isPending || rejectMut.isPending

  // ── Каталог: сортировка по маркам, при выборе марки — её модели ──
  const [selectedMake, setSelectedMake] = useState<string | null>(null)

  const makes = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of others) m.set(r.make, (m.get(r.make) ?? 0) + 1)
    return [...m.entries()]
      .map(([make, count]) => ({ make, count }))
      .sort((a, b) => a.make.localeCompare(b.make, 'ru'))
  }, [others])

  // авто-выбор первой марки; сброс, если выбранной больше нет
  useEffect(() => {
    if (makes.length && (!selectedMake || !makes.some(m => m.make === selectedMake))) {
      setSelectedMake(makes[0].make)
    } else if (!makes.length && selectedMake) {
      setSelectedMake(null)
    }
  }, [makes, selectedMake])

  const modelsOfMake = others
    .filter(r => r.make === selectedMake)
    .sort((a, b) => a.sort_order - b.sort_order || a.model.localeCompare(b.model, 'ru'))

  return (
    <div className="space-y-5">
      {/* Шапка */}
      <div className="page-header">
        <div>
          <p className="kicker mb-1">Администрирование</p>
          <h1 className="page-title">Каталог авто</h1>
          <p className="page-subtitle">Марки и модели для разборок · заявки на утверждение</p>
        </div>
        <div className="flex gap-1.5 bg-gray-100 dark:bg-white/5 p-1 rounded-xl flex-shrink-0">
          {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filter === f
                  ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Быстрое добавление модели в каталог */}
      <div className="card p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
          <div className="flex-1">
            <label className="form-label">Марка</label>
            <input value={newMake} onChange={e => setNewMake(e.target.value)} className="form-input" placeholder="Tesla" />
          </div>
          <div className="flex-1">
            <label className="form-label">Модель</label>
            <input value={newModel} onChange={e => setNewModel(e.target.value)} className="form-input" placeholder="Roadster" />
          </div>
          <button
            onClick={() => addMut.mutate()}
            disabled={!newMake.trim() || !newModel.trim() || addMut.isPending}
            className="cab-btn cab-btn-primary flex-shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} /> Добавить
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-5 h-5 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              {filter === 'pending' ? <Clock className="w-7 h-7 text-gray-400" strokeWidth={1.5} /> : <Car className="w-7 h-7 text-gray-400" strokeWidth={1.5} />}
            </div>
            <p className="empty-state-title">{filter === 'pending' ? 'Нет заявок' : 'Пусто'}</p>
            <p className="empty-state-text">
              {filter === 'pending' ? 'Все заявки на марки/модели обработаны' : 'В этой категории пока ничего нет'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Заявки — карточки с правкой */}
          {pending.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {pending.map((r: CarModelRow) => (
                <PendingCard
                  key={r.id}
                  row={r}
                  busy={busy}
                  onApprove={(make, model, yearFrom, yearTo) => approveMut.mutate({ id: r.id, make, model, yearFrom, yearTo })}
                  onReject={() => rejectMut.mutate(r.id)}
                />
              ))}
            </div>
          )}

          {/* Каталог: сортировка по маркам → выбор марки показывает модели */}
          {others.length > 0 && (
            <div className="space-y-3">
              {/* Марки (А→Я) */}
              <div className="flex flex-wrap gap-1.5">
                {makes.map(m => {
                  const active = m.make === selectedMake
                  return (
                    <button
                      key={m.make}
                      onClick={() => setSelectedMake(m.make)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold border transition inline-flex items-center gap-1.5"
                      style={active
                        ? { background: 'var(--cab-ink)', color: '#fff', borderColor: 'var(--cab-ink)' }
                        : { background: '#fff', color: 'var(--cab-ink-2)', borderColor: 'var(--cab-border)' }}
                    >
                      <Car className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {m.make}
                      <span className={active ? 'opacity-70' : 'text-gray-400'}>{m.count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Модели выбранной марки */}
              {selectedMake && (
                <div className="card p-0 overflow-hidden">
                  <div className="px-4 h-11 flex items-center" style={{ borderBottom: '1px solid var(--cab-border)' }}>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedMake} · модели <span className="text-gray-400 font-medium">({modelsOfMake.length})</span>
                    </p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header-cell">Модель</th>
                        <th className="table-header-cell whitespace-nowrap">Года</th>
                        <th className="table-header-cell">Статус</th>
                        <th className="table-header-cell w-40 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="grid-hairline">
                      {modelsOfMake.map(r => {
                        const badge = STATUS_BADGE[r.status]
                        return (
                          <tr key={r.id} className="table-row">
                            <td className="table-cell font-semibold text-gray-900">{r.model}</td>
                            <td className="table-cell text-xs text-gray-500 whitespace-nowrap tabular-nums">
                              {r.year_from && r.year_to ? `${r.year_from}–${r.year_to}` : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="table-cell">
                              <span className={badge.cls}>{badge.label}</span>
                              {r.status === 'approved' && !r.is_active && <span className="badge badge-gray ml-1">скрыта</span>}
                            </td>
                            <td className="table-cell">
                              <div className="flex justify-end gap-1.5">
                                {r.status === 'approved' && (
                                  <button onClick={() => toggleMut.mutate({ id: r.id, active: !r.is_active })} disabled={toggleMut.isPending} className="cab-btn cab-btn-secondary cab-btn-sm">
                                    {r.is_active ? <><EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} /> Скрыть</> : <><Eye className="w-3.5 h-3.5" strokeWidth={1.5} /> Показать</>}
                                  </button>
                                )}
                                {r.status === 'rejected' && (
                                  <button onClick={() => approveMut.mutate({ id: r.id, make: r.make, model: r.model, yearFrom: r.year_from, yearTo: r.year_to })} disabled={approveMut.isPending} className="cab-btn cab-btn-success cab-btn-sm">
                                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Утвердить
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
