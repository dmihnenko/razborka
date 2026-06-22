import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { CreatePartsOrderInput } from '@/types/parts'
import { createPartsOrder } from '@/services/partsService'
import { useNavigate } from 'react-router-dom'
import { Plus, Info, Search, X, User } from 'lucide-react'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'
import { useTranslation } from 'react-i18next'

/** Совпадение телефона по цифрам: запрос — подпоследовательность цифр номера.
 *  «355253» найдёт «0953552553» (цифры по порядку, можно пропускать). */
function phoneDigitsMatch(phone: string, queryDigits: string): boolean {
  if (!queryDigits) return false
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.includes(queryDigits)) return true
  let i = 0
  for (let k = 0; k < digits.length && i < queryDigits.length; k++) {
    if (digits[k] === queryDigits[i]) i++
  }
  return i === queryDigits.length
}

export default function PartsCreateOrder() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<CreatePartsOrderInput>({
    customer_id: undefined,
    notes: '',
  })

  // Поиск/выбор клиента (по имени или телефону)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const customerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!customerOpen) return
    const onDoc = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setCustomerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [customerOpen])

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

  const selectedCustomer = customers.find((c) => c.id === formData.customer_id) || null
  const cq = customerSearch.trim().toLowerCase()
  const cqDigits = cq.replace(/\D/g, '') // только цифры — для поиска по части номера
  const filteredCustomers = cq
    ? customers.filter((c) => {
        const nameMatch = (c.full_name || '').toLowerCase().includes(cq)
        // Телефон: по цифрам как подпоследовательность («355253» → «0953552553»)
        const phoneMatch = cqDigits.length > 0 && phoneDigitsMatch(c.phone || '', cqDigits)
        return nameMatch || phoneMatch
      })
    : customers
  const selectCustomer = (cid: string | null) => {
    setFormData((f) => ({ ...f, customer_id: cid || undefined }))
    setCustomerOpen(false)
    setCustomerSearch('')
  }

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <PartsPageHeader title={i18n.t('cabinet:pages.createOrder')} backPath="/parts/orders" maxWidth="3xl" />

      <div className="max-w-3xl mx-auto px-3 sm:px-5 lg:px-8 py-5 sm:py-7">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Клиент + Примечание — единый card */}
          <div className="cab-card p-4 space-y-4">
            <div>
              <label htmlFor="customer_id" className="form-label">
                {t('createOrderPage.customer')}
              </label>
              {customersLoading ? (
                <p className="text-sm text-gray-500 py-2">{t('createOrderPage.loadingCustomers')}</p>
              ) : selectedCustomer ? (
                /* Выбранный клиент — чип с возможностью сбросить */
                <div className="flex items-center justify-between gap-2 form-input">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate">
                      {selectedCustomer.full_name}
                      {selectedCustomer.phone && <span className="text-gray-400"> · {selectedCustomer.phone}</span>}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => selectCustomer(null)}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                    aria-label={t('createOrderPage.resetCustomer')}
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              ) : (
                /* Поиск клиента по имени или телефону + выбор из списка */
                <div className="relative" ref={customerRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setCustomerOpen(true) }}
                    onFocus={() => setCustomerOpen(true)}
                    placeholder={t('createOrderPage.searchPlaceholder')}
                    className="form-input pl-9"
                  />
                  {customerOpen && (
                    <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                      <button
                        type="button"
                        onClick={() => selectCustomer(null)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500"
                      >
                        {t('createOrderPage.noCustomer')}
                      </button>
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer.id)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 border-t border-gray-50 dark:border-slate-700/50"
                        >
                          <span className="block text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{customer.full_name}</span>
                          {(customer.phone || customer.email) && (
                            <span className="block text-xs text-gray-400 truncate">
                              {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <p className="px-3 py-3 text-sm text-gray-400">{t('createOrderPage.customerNotFound')}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-400">{t('createOrderPage.optional')}</p>
                <button
                  type="button"
                  onClick={() => navigate('/parts/customers')}
                  className="cab-btn cab-btn-ghost text-xs text-primary font-medium"
                >
                  {t('createOrderPage.addCustomer')}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-white/5 pt-4">
              <label htmlFor="notes" className="form-label">
                {t('createOrderPage.notes')}
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="form-input resize-none"
                placeholder={t('createOrderPage.notesPlaceholder')}
              />
            </div>
          </div>

          {/* Ошибка мутации */}
          {createMutation.isError && (
            <div className="alert alert-danger">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{t('createOrderPage.createError')}</p>
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
              className="cab-btn cab-btn-secondary sm:w-auto w-full"
            >
              {t('createOrderPage.cancel')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="cab-btn cab-btn-primary sm:w-auto w-full flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  {t('createOrderPage.creating')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t('createOrderPage.submit')}
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
