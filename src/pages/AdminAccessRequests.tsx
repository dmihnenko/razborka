import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAccessRequests, approveAccessRequest, rejectAccessRequest } from '@/services/adminService'
import type { AccessRequest } from '@/services/adminService'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Clock, Building2, Phone, MapPin, User, Package, Car, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const roleLabels: Record<string, string> = {
  parts_owner: 'Владелец разборки',
  parts_worker: 'Авторазборка',
  user: 'Личные автомобили',
}

const roleIcons: Record<string, LucideIcon> = {
  parts_owner: Package,
  parts_worker: Package,
  user: Car,
}

const roleBadgeClass: Record<string, string> = {
  parts_owner: 'badge badge-orange',
  parts_worker: 'badge badge-yellow',
  user: 'badge badge-purple',
}

const roleIconBg: Record<string, string> = {
  parts_owner: 'bg-orange-50 text-orange-600',
  parts_worker: 'bg-amber-50 text-amber-600',
  user: 'bg-purple-50 text-purple-600',
}

export default function AdminAccessRequests() {
  const queryClient = useQueryClient()
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-access-requests', filter],
    queryFn: () => fetchAccessRequests(filter),
  })

  const approveMutation = useMutation({
    mutationFn: (req: AccessRequest) => approveAccessRequest(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-access-requests'] })
      toast.success('Заявка одобрена')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка при одобрении'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectAccessRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-access-requests'] })
      setRejectingId(null)
      setRejectReason('')
      toast.success('Заявка отклонена')
    },
    onError: () => toast.error('Ошибка'),
  })

  const filterLabels: Record<string, string> = {
    pending: 'Ожидают',
    approved: 'Одобрены',
    rejected: 'Отклонены',
    all: 'Все',
  }

  return (
    <div className="space-y-5">

      {/* Шапка страницы */}
      <div className="page-header">
        <div>
          <p className="kicker mb-1">Администрирование</p>
          <h1 className="page-title">Заявки на доступ</h1>
          <p className="page-subtitle">Управление запросами пользователей</p>
        </div>

        {/* Фильтр-чипы */}
        <div className="flex gap-1.5 bg-gray-100 dark:bg-white/5 p-1 rounded-xl flex-shrink-0">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filter === f
                  ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Состояния: загрузка / пусто / список */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-5 h-5 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Clock className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
            </div>
            <p className="empty-state-title">Нет заявок</p>
            <p className="empty-state-text">
              {filter === 'pending' ? 'Все заявки обработаны' : 'В этой категории пока ничего нет'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop — таблица */}
          <div className="card hidden sm:block p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header-cell">Пользователь</th>
                  <th className="table-header-cell">Тип</th>
                  <th className="table-header-cell">Компания / контакт</th>
                  <th className="table-header-cell">Дата</th>
                  <th className="table-header-cell">Статус</th>
                  <th className="table-header-cell w-40">Действия</th>
                </tr>
              </thead>
              <tbody className="grid-hairline">
                {requests.map((req: AccessRequest) => {
                  const Icon = roleIcons[req.request_type] || User
                  const isRejecting = rejectingId === req.id
                  return (
                    <>
                      <tr key={req.id} className="table-row">
                        {/* Пользователь */}
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className={`icon-tile-sm ${roleIconBg[req.request_type] || 'bg-gray-100 text-gray-500'}`}>
                              <Icon className="w-4 h-4" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {req.user?.full_name || req.user?.username || 'Без имени'}
                              </p>
                              <p className="text-xs text-gray-400 truncate">@{req.user?.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Тип */}
                        <td className="table-cell">
                          <span className={roleBadgeClass[req.request_type] || 'badge badge-gray'}>
                            {roleLabels[req.request_type] || req.request_type}
                          </span>
                        </td>

                        {/* Компания / контакт */}
                        <td className="table-cell">
                          <div className="space-y-0.5 text-xs text-gray-600">
                            {req.owner_name && (
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                                <span>{req.owner_name}</span>
                              </div>
                            )}
                            {req.company_name && (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                                <span className="font-medium">{req.company_name}</span>
                              </div>
                            )}
                            {(req.company_phone || req.owner_phone) && (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                                <span className="font-mono">{req.company_phone || req.owner_phone}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Дата */}
                        <td className="table-cell text-xs text-gray-500 whitespace-nowrap">
                          {new Date(req.created_at).toLocaleDateString('ru-RU')}
                        </td>

                        {/* Статус */}
                        <td className="table-cell">
                          {req.status === 'pending' && (
                            <span className="badge badge-yellow">
                              <span className="status-dot status-dot-pulse bg-yellow-500" />
                              Ожидает
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <span className="badge badge-green">
                              <span className="status-dot bg-green-500" />
                              Одобрено
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="badge badge-red">
                              <span className="status-dot bg-red-500" />
                              Отклонено
                            </span>
                          )}
                        </td>

                        {/* Действия */}
                        <td className="table-cell">
                          {req.status === 'pending' && !isRejecting && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => { setRejectingId(req.id); setRejectReason('') }}
                                className="cab-btn cab-btn-danger cab-btn-sm"
                              >
                                <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                                Откл.
                              </button>
                              <button
                                onClick={() => approveMutation.mutate(req)}
                                disabled={approveMutation.isPending}
                                className="cab-btn cab-btn-success cab-btn-sm"
                              >
                                {approveMutation.isPending
                                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  : <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                }
                                Одобрить
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Строка отклонения — раскрывается под строкой */}
                      {isRejecting && (
                        <tr key={`${req.id}-reject`} className="bg-red-50/40 dark:bg-red-900/10">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                rows={2}
                                placeholder="Причина отклонения (опционально)..."
                                className="form-input flex-1 resize-none text-sm"
                              />
                              <div className="flex gap-2 flex-shrink-0 pt-0.5">
                                <button
                                  onClick={() => setRejectingId(null)}
                                  className="cab-btn cab-btn-secondary cab-btn-sm"
                                >
                                  Отмена
                                </button>
                                <button
                                  onClick={() => rejectMutation.mutate({ id: req.id, reason: rejectReason })}
                                  disabled={rejectMutation.isPending}
                                  className="cab-btn cab-btn-danger cab-btn-sm"
                                >
                                  {rejectMutation.isPending
                                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  }
                                  Отклонить
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile — карточки */}
          <div className="sm:hidden space-y-3">
            {requests.map((req: AccessRequest) => {
              const Icon = roleIcons[req.request_type] || User
              const isRejecting = rejectingId === req.id
              return (
                <div
                  key={req.id}
                  className={`card p-0 overflow-hidden ${
                    req.status === 'rejected'
                      ? 'border-red-200/60'
                      : req.status === 'approved'
                      ? 'border-green-200/60'
                      : ''
                  }`}
                >
                  {/* Заголовок карточки */}
                  <div className="px-4 py-3 flex items-start gap-3">
                    <div className={`icon-tile flex-shrink-0 ${roleIconBg[req.request_type] || 'bg-gray-100 text-gray-500'}`}>
                      <Icon className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {req.user?.full_name || req.user?.username || 'Без имени'}
                        </p>
                        <span className={roleBadgeClass[req.request_type] || 'badge badge-gray'}>
                          {roleLabels[req.request_type]}
                        </span>
                        {req.status === 'pending' && (
                          <span className="badge badge-yellow">
                            <span className="status-dot status-dot-pulse bg-yellow-500" />
                            Ожидает
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="badge badge-green">
                            <span className="status-dot bg-green-500" />
                            Одобрено
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="badge badge-red">
                            <span className="status-dot bg-red-500" />
                            Отклонено
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        @{req.user?.username} · {new Date(req.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  {/* Детали */}
                  {(req.company_name || req.owner_phone || req.company_address || req.owner_name || req.vehicle_makes) && (
                    <div className="px-4 pb-3 pt-2.5 space-y-1.5 border-t border-gray-100 dark:border-white/5">
                      {req.owner_name && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                          <span className="font-medium">{req.owner_name}</span>
                        </div>
                      )}
                      {req.company_name && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                          <span className="font-medium">{req.company_name}</span>
                        </div>
                      )}
                      {req.company_address && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                          <span>{req.company_address}</span>
                        </div>
                      )}
                      {(req.company_phone || req.owner_phone) && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                          <span className="font-mono">{req.company_phone || req.owner_phone}</span>
                        </div>
                      )}
                      {req.vehicle_makes && req.vehicle_makes.trim() && (
                        <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Wrench className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                          <div className="flex flex-wrap gap-1">
                            {req.vehicle_makes
                              .split(',')
                              .map((make: string) => make.trim())
                              .filter(Boolean)
                              .map((make: string) => (
                                <span key={make} className="badge badge-blue">{make}</span>
                              ))}
                          </div>
                        </div>
                      )}
                      {req.rejection_reason && (
                        <div className="alert alert-danger mt-2">
                          <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                          <span>{req.rejection_reason}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Форма отклонения */}
                  {isRejecting && (
                    <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-white/5 space-y-2">
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="Причина отклонения (опционально)..."
                        className="form-input resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRejectingId(null)}
                          className="cab-btn cab-btn-secondary flex-1"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate({ id: req.id, reason: rejectReason })}
                          disabled={rejectMutation.isPending}
                          className="cab-btn cab-btn-danger flex-1"
                        >
                          {rejectMutation.isPending
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <XCircle className="w-4 h-4" strokeWidth={1.5} />
                          }
                          Отклонить
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Кнопки действий */}
                  {req.status === 'pending' && !isRejecting && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 flex gap-2">
                      <button
                        onClick={() => { setRejectingId(req.id); setRejectReason('') }}
                        className="cab-btn cab-btn-danger flex-1"
                      >
                        <XCircle className="w-4 h-4" strokeWidth={1.5} />
                        Отклонить
                      </button>
                      <button
                        onClick={() => approveMutation.mutate(req)}
                        disabled={approveMutation.isPending}
                        className="cab-btn cab-btn-success flex-1"
                      >
                        {approveMutation.isPending
                          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                        }
                        Одобрить
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
