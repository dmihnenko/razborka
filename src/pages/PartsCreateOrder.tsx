import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { CreatePartsOrderInput } from '@/types/parts'
import { createPartsOrder } from '@/services/partsService'
import { useNavigate } from 'react-router-dom'
import { Plus, Users as UsersIcon } from 'lucide-react'
import PartsPageHeader from '@/components/parts/PartsPageHeader'

export default function PartsCreateOrder() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<CreatePartsOrderInput>({
    customer_id: undefined,
    notes: '',
  })

  // Получить список клиентов
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['parts-customers-dropdown', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_customers')
        .select('id, full_name, phone, email')
        .eq('parts_company_id', partsCompanyId)
        .order('full_name')

      if (error) throw error
      return data
    },
    enabled: !!partsCompanyId,
  })

  const createMutation = useMutation({
    mutationFn: async (input: CreatePartsOrderInput) => {
      if (!partsCompanyId) throw new Error('No company')
      return createPartsOrder(partsCompanyId, {
        customer_id: input.customer_id || null,
        notes: input.notes || undefined,
      })
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      // Перейти на страницу заказа для добавления товаров
      navigate(`/parts/orders/${order.id}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader title="Создание заказа" backPath="/parts/orders" maxWidth="3xl" />

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              
              <h2 className="text-lg font-semibold text-gray-900">Информация о клиенте</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите клиента
                </label>
                {customersLoading ? (
                  <div className="text-sm text-gray-500">Загрузка клиентов...</div>
                ) : (
                  <select
                    value={formData.customer_id || ''}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value || undefined })}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Без клиента (розничная продажа)</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.full_name}
                        {customer.phone && ` • ${customer.phone}`}
                        {customer.email && ` • ${customer.email}`}
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-2 text-sm text-gray-500">
                  Клиент необязателен. Можно создать заказ без привязки к клиенту.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-gray-600">Нужного клиента нет в списке?</span>
                <button
                  type="button"
                  onClick={() => navigate('/parts/customers')}
                  className="text-sm text-primary hover:text-primary/80 font-medium"
                >
                  Добавить клиента
                </button>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Дополнительная информация</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Примечание к заказу
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                placeholder="Дополнительная информация о заказе, особые пожелания клиента..."
              />
              <p className="mt-2 text-sm text-gray-500">
                Необязательное поле. Можно добавить любую полезную информацию.
              </p>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900 mb-1">Что дальше?</h3>
                <p className="text-sm text-blue-800">
                  После создания заказа вы перейдете на страницу заказа, где сможете добавить запчасти из склада, указать количество и цены.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/parts/orders')}
              className="flex-1 sm:flex-none px-6 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 sm:flex-auto px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Создание...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Создать заказ
                </>
              )}
            </button>
          </div>

          {createMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                Ошибка при создании заказа. Попробуйте еще раз.
              </p>
              {(createMutation.error as any)?.message && (
                <p className="text-xs text-red-600 mt-1">{(createMutation.error as any).message}</p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
