import { AppointmentFormValues, AppointmentStatus } from '@/types/appointments'
import { User, Car, Wrench, Package, Calendar, FileText, UserCog } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'

interface Props {
  formData: AppointmentFormValues
  onUpdate: (data: Partial<AppointmentFormValues>) => void
}

const statusLabels: Record<AppointmentStatus, string> = {
  'pending': '⏳ Ожидает',
  'confirmed': '✅ Подтверждена',
  'in_progress': '🔧 В работе',
  'completed': '✔️ Завершена',
  'cancelled': '❌ Отменена',
  'paid': '💰 Оплачена',
}

export default function AppointmentSummary({ formData, onUpdate }: Props) {
  const { data: profile } = useUserProfile()
  const totalWork = formData.workItems.reduce((sum, item) => sum + item.price, 0)
  const totalParts = formData.partItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const grandTotal = totalWork + totalParts

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
        .eq('sto_company_id', profile.sto_company_id)
      
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
                    {item.quantity} шт × {item.price} грн
                    {item.articleNumber && ` • ${item.articleNumber}`}
                  </div>
                </div>
                <div className="font-semibold text-primary whitespace-nowrap ml-4">
                  {item.totalPrice.toLocaleString()} грн
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Всего запчастей:</span>
              <span className="text-primary">{totalParts.toLocaleString()} грн</span>
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

      {workers && workers.length > 0 && (
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Дата записи *
          </label>
          <input
            type="datetime-local"
            required
            value={formData.scheduledDate}
            onChange={(e) => onUpdate({ scheduledDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
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
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

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
