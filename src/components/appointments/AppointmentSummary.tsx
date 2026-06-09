import { AppointmentFormValues, AppointmentStatus } from '@/types/appointments'
import { User, Car, Wrench, Package, FileText, UserCog, CalendarClock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'

interface Props {
  formData: AppointmentFormValues
  onUpdate: (data: Partial<AppointmentFormValues>) => void
  isEditing?: boolean
}

const statusLabels: Partial<Record<AppointmentStatus, string>> = {
  'in_progress': '🔧 В работе',
  'ready': '✅ Готова',
  'completed': '✔️ Завершена',
  'cancelled': '❌ Отменена',
  'pending_deletion': '🗑️ Ожидает удаления',
  'deleted': '🚫 Удалена',
}

export default function AppointmentSummary({ formData, onUpdate, isEditing }: Props) {
  const { data: profile } = useUserProfile()
  const totalWork = formData.workItems.reduce((sum, item) => sum + item.price, 0)
  const totalParts = formData.partItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const grandTotal = totalWork + totalParts

  // Время и мастер для сводки
  const catalogNormHours = formData.workItems.reduce((s, i) => s + ((i as any).normHours || 0), 0)
  const billableHours = catalogNormHours + (formData.extraHours || 0)
  const fmtHours = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1))
  const sdMatch = String(formData.scheduledDate || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  const dateLabel = sdMatch ? `${sdMatch[3]}.${sdMatch[2]}.${sdMatch[1]}` : ''
  const startTime = sdMatch ? `${sdMatch[4]}:${sdMatch[5]}` : ''
  let endTime = ''
  if (sdMatch && billableHours > 0) {
    const start = new Date(+sdMatch[1], +sdMatch[2] - 1, +sdMatch[3], +sdMatch[4], +sdMatch[5])
    const end = new Date(start.getTime() + billableHours * 3600 * 1000)
    endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
  }

  // Проверка ролей
  const isStoWorker = profile?.roles?.some((r: any) => r.name === 'sto_worker')
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Загружаем список работников СТО
  const { data: workers } = useQuery({
    queryKey: ['sto-workers', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return []
      
      // Получаем ID роли sto_worker
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'sto_worker')
        .single()
      
      if (!role) return []
      
      // Получаем всех пользователей с ролью sto_worker
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', role.id)
      
      if (!userRoles || userRoles.length === 0) return []
      
      const userIds = userRoles.map(ur => ur.user_id)
      
      // Получаем профили работников из текущей СТО
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds)
        .eq('sto_company_id', profile?.sto_company_id)
      
      return profiles || []
    },
    enabled: !!profile?.sto_company_id,
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-gray-900">Клиент</h3>
        </div>
        <div className="ml-7">
          <div className="font-medium">{formData.selectedClient?.name}</div>
          <div className="text-sm text-gray-600">{formData.selectedClient?.phone}</div>
          {formData.selectedClient?.notes && (
            <div className="text-sm text-gray-500 mt-1">{formData.selectedClient.notes}</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Car className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-gray-900">Автомобиль</h3>
        </div>
        <div className="ml-7">
          <div className="font-medium">{formData.selectedVehicle?.brand} {formData.selectedVehicle?.model}</div>
          <div className="text-sm text-gray-600">VIN: {formData.selectedVehicle?.vin}</div>
          {formData.selectedVehicle?.year && (
            <div className="text-sm text-gray-500">{formData.selectedVehicle.year} г.</div>
          )}
        </div>
      </div>

      {/* Время и мастер */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-gray-900">Время и мастер</h3>
        </div>
        <div className="ml-7 space-y-1 text-sm">
          {dateLabel && <div><span className="text-gray-500">Дата:</span> <span className="font-medium text-gray-900">{dateLabel}</span></div>}
          {startTime && (
            <div>
              <span className="text-gray-500">Время:</span>{' '}
              <span className="font-medium text-gray-900">
                {startTime}{endTime ? ` – ${endTime}` : ''}{billableHours > 0 ? ` · ${fmtHours(billableHours)} ч` : ''}
              </span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Мастер:</span>{' '}
            <span className="font-medium text-gray-900">
              {(() => {
                const w = workers?.find((x: any) => x.id === formData.assigned_to)
                return w?.full_name || w?.email || (formData.assigned_to ? 'Назначен' : 'Не назначен')
              })()}
            </span>
          </div>
        </div>
      </div>

      {formData.workItems.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-gray-900">Работы ({formData.workItems.length})</h3>
          </div>
          <div className="ml-7 space-y-2">
            {formData.workItems.map((item, idx) => (
              <div key={item.id} className="flex justify-between">
                <div>
                  <div className="font-medium">{idx + 1}. {item.name}</div>
                  {item.description && (
                    <div className="text-sm text-gray-500">{item.description}</div>
                  )}
                </div>
                <div className="font-semibold text-primary whitespace-nowrap ml-4">
                  {item.price.toLocaleString()} грн
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Всего работ:</span>
              <span className="text-primary">{totalWork.toLocaleString()} грн</span>
            </div>
          </div>
        </div>
      )}

      {formData.partItems.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-gray-900">Запчасти ({formData.partItems.length})</h3>
          </div>
          <div className="ml-7 space-y-2">
            {formData.partItems.map((item, idx) => (
              <div key={item.id} className="flex justify-between">
                <div>
                  <div className="font-medium">{idx + 1}. {item.name}</div>
                  <div className="text-sm text-gray-500">
                    Цена: ₴{(item.price || 0).toFixed(2)} | Кол-во: {item.quantity || 1}
                    {/* Закупка: ₴{item.price.toFixed(2)} | Наценка:{' '}
                    {item.markupType === 'percentage' ? `${item.markup}%` : `₴${item.markup.toFixed(2)}`} |
                    Кол-во: {item.quantity} */}
                  </div>
                </div>
                <div className="font-semibold text-primary whitespace-nowrap ml-4">
                  ₴{(item.totalPrice || 0).toLocaleString()}
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Всего запчастей:</span>
              <span className="text-primary">₴{totalParts.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-primary/10 rounded-lg border-2 border-primary p-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>ИТОГО:</span>
          <span className="text-primary text-xl">{grandTotal.toLocaleString()} грн</span>
        </div>
      </div>

      {isStoOwner && workers && workers.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <UserCog className="w-4 h-4 inline mr-1" />
            Назначить работника
          </label>
          <select
            value={formData.assigned_to || ''}
            onChange={(e) => onUpdate({ assigned_to: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Не назначено</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.full_name || worker.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {isStoOwner && (totalParts > 0 || totalWork > 0) && (
        <p className="text-xs text-gray-400">
          Оплата работ и запчастей проставляется автоматически при оплате счёта по заявке.
        </p>
      )}

      {isEditing && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="w-4 h-4 inline mr-1" />
            Статус *
          </label>
          <select
            value={formData.status}
            onChange={(e) => onUpdate({ status: e.target.value as AppointmentStatus })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {isStoWorker && !isStoOwner ? (
              // Работник может ставить только "Готова"
              <>
                <option value="in_progress">🔧 В работе</option>
                <option value="ready">✅ Готова</option>
              </>
            ) : (
              // Владелец может выбирать любой статус
              Object.entries(statusLabels)
                .filter(([key]) => key !== 'pending_deletion' && key !== 'deleted')
                .map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))
            )}
          </select>
          {isStoOwner && formData.status === 'ready' && (totalParts > 0 || totalWork > 0) && !(formData.parts_paid && formData.work_paid) && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Для завершения необходимо отметить оплату
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Примечания
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          placeholder="Дополнительные заметки к записи..."
        />
      </div>
    </div>
  )
}
