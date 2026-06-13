import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { CreatePartsOrderInput } from '@/types/parts'
import { createPartsOrder } from '@/services/partsService'
import { useNavigate } from 'react-router-dom'
import { Plus, Info } from 'lucide-react'
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
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <PartsPageHeader title="Создание заказа" backPath="/parts/orders" maxWidth="3xl" />

      <div className="max-w-3xl mx-auto px-3 sm:px-5 lg:px-8 py-5 sm:py-7">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Клиент */}
          <div className="card p-5 sm:p-6">
            <p className="kicker mb-1">клиент</p>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-4">
              Информация о клиенте
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="customer_id" className="form-label">
                  Выберите клиента
                </label>
                {customersLoading ? (
                  <p className="text-sm text-gray-500 py-2">Загрузка клиентов…</p>
                ) : (
                  <select
                    id="customer_id"
                    value={formData.customer_id || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_id: e.target.value || undefined })
                    }
                    className="form-select"
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
                <p className="mt-1.5 text-xs text-gray-500">
                  Клиент необязателен. Можно создать заказ без привязки к клиенту.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-white/5">
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  Нужного клиента нет в списке?
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/parts/customers')}
                  className="btn-ghost text-sm text-primary font-medium"
                >
                  Добавить клиента
                </button>
              </div>
            </div>
          </div>

          {/* Дополнительная информация */}
          <div className="card p-5 sm:p-6">
            <p className="kicker mb-1">примечание</p>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-4">
              Дополнительная информация
            </h2>

            <div>
              <label htmlFor="notes" className="form-label">
                Примечание к заказу
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="form-input resize-none"
                placeholder="Дополнительная информация о заказе, особые пожелания клиента…"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Необязательное поле. Можно добавить любую полезную информацию.
              </p>
            </div>
          </div>

          {/* Подсказка */}
          <div className="alert alert-info">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Что дальше?</p>
              <p>
                После создания заказа вы перейдёте на страницу заказа, где сможете добавить
                запчасти из склада, указать количество и цены.
              </p>
            </div>
          </div>

          {/* Ошибка мутации */}
          {createMutation.isError && (
            <div className="alert alert-danger">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Ошибка при создании заказа. Попробуйте ещё раз.</p>
                {(createMutation.error as Error)?.message && (
                  <p className="text-xs mt-0.5 opacity-80">
                    {(createMutation.error as Error).message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Действия */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/parts/orders')}
              className="btn-secondary sm:w-auto w-full"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary sm:w-auto w-full flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Создание…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Создать заказ
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
