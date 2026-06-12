import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAccessRequests, approveAccessRequest, rejectAccessRequest } from '@/services/adminService'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Clock, Building2, Phone, MapPin, User, Package, Car, Wrench } from 'lucide-react'

const roleLabels: Record<string, string> = {
  parts_owner: 'Владелец разборки',
  parts_worker: 'Авторазборка',
  user: 'Личные автомобили',
}

const roleIcons: Record<string, any> = {
  parts_owner: Package,
  parts_worker: Package,
  user: Car,
}

const roleColors: Record<string, string> = {
  parts_owner: 'bg-orange-100 text-orange-700',
  parts_worker: 'bg-amber-100 text-amber-700',
  user: 'bg-purple-100 text-purple-700',
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
    mutationFn: (req: any) => approveAccessRequest(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-access-requests'] })
      toast.success('Заявка одобрена')
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка при одобрении'),
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Заявки на доступ</h1>
          <p className="text-xs text-gray-400 mt-0.5">Управление запросами пользователей</p>
        </div>
        {/* Фильтр */}
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {f === 'pending' ? 'Ожидают' : f === 'approved' ? 'Одобрены' : f === 'rejected' ? 'Отклонены' : 'Все'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-5 h-5 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Нет заявок</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => {
            const Icon = roleIcons[req.request_type] || User
            const isRejecting = rejectingId === req.id
            return (
              <div key={req.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                req.status === 'rejected' ? 'border-red-100' : req.status === 'approved' ? 'border-emerald-100' : 'border-gray-100'
              }`}>
                {/* Хедер карточки */}
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${roleColors[req.request_type] || 'bg-gray-100 text-gray-600'}`}>
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{req.user?.full_name || req.user?.username || 'Без имени'}</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${roleColors[req.request_type] || 'bg-gray-100 text-gray-600'}`}>
                        {roleLabels[req.request_type]}
                      </span>
                      {req.status === 'pending' && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Ожидает</span>}
                      {req.status === 'approved' && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Одобрено</span>}
                      {req.status === 'rejected' && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Отклонено</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">@{req.user?.username} · {new Date(req.created_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                </div>

                {/* Детали */}
                {(req.company_name || req.owner_phone || req.company_address || req.owner_name || req.vehicle_makes) && (
                  <div className="px-5 pb-3 space-y-1.5 border-t border-gray-100 pt-3">
                    {req.owner_name && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                        <span className="font-medium">{req.owner_name}</span>
                      </div>
                    )}
                    {req.company_name && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                        <span className="font-medium">{req.company_name}</span>
                      </div>
                    )}
                    {req.company_address && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                        <span>{req.company_address}</span>
                      </div>
                    )}
                    {(req.company_phone || req.owner_phone) && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                        <span className="font-mono">{req.company_phone || req.owner_phone}</span>
                      </div>
                    )}
                    {req.vehicle_makes && req.vehicle_makes.trim() && (
                      <div className="flex items-start gap-2 text-xs text-gray-500 mt-1">
                        <Wrench className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <div className="flex flex-wrap gap-1">
                          {req.vehicle_makes.split(',').map((make: string) => make.trim()).filter(Boolean).map((make: string) => (
                            <span key={make} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                              {make}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {req.rejection_reason && (
                      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <span>{req.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Форма отклонения */}
                {isRejecting && (
                  <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-2">
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      rows={2} placeholder="Причина отклонения (опционально)..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                    <div className="flex gap-2">
                      <button onClick={() => setRejectingId(null)}
                        className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                        Отмена
                      </button>
                      <button onClick={() => rejectMutation.mutate({ id: req.id, reason: rejectReason })}
                        disabled={rejectMutation.isPending}
                        className="flex-1 py-2 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors">
                        Отклонить
                      </button>
                    </div>
                  </div>
                )}

                {/* Кнопки действий */}
                {req.status === 'pending' && !isRejecting && (
                  <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
                    <button onClick={() => { setRejectingId(req.id); setRejectReason('') }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                      <XCircle className="w-4 h-4" strokeWidth={1.5} />
                      Отклонить
                    </button>
                    <button onClick={() => approveMutation.mutate(req)}
                      disabled={approveMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
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
      )}
    </div>
  )
}
