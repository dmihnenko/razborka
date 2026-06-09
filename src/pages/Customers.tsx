import { useState, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Phone, Mail, Car, Search } from 'lucide-react'
import { IMaskInput } from 'react-imask'
import { useNavigate, Link } from 'react-router-dom'
import { useHasAnyRole, useUserProfile } from '@/hooks/useUserProfile'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/PageHeader'
import { moveToTrash } from '@/services/trashService'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import SubscriptionUpgradeModal from '@/components/SubscriptionUpgradeModal'
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCustomerForTrash,
} from '@/services/customersService'

interface CustomerModalProps {
  customer: any
  onClose: () => void
}

export default function Customers() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const canDelete = useHasAnyRole(['admin', 'sto_owner'])
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const { data: profile } = useUserProfile()
  const { canCreate, usage, limits, plan } = useSubscriptionLimits()
  const [showUpgrade, setShowUpgrade] = useState(false)

  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  const isStoWorker = profile?.roles?.some((r: any) => r.name === 'sto_worker')
  const stoCompanyId = profile?.sto_company_id

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', stoCompanyId],
    // Ждём загрузки профиля и company_id — НИКОГДА не грузим без фильтра
    enabled: !!profile && !!(stoCompanyId),
    queryFn: () =>
      fetchCustomers({ stoCompanyId }),
  })

  // Фильтрация клиентов по поисковому запросу
  const filteredCustomers = useMemo(() => {
    if (!customers) return []
    if (!searchQuery.trim()) return customers

    const query = searchQuery.toLowerCase().trim()
    return customers.filter((customer) => {
      const name = customer.name?.toLowerCase() || ''
      const phone = customer.phone?.toLowerCase() || ''
      const email = customer.email?.toLowerCase() || ''
      
      return name.includes(query) || phone.includes(query) || email.includes(query)
    })
  }, [customers, searchQuery])

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { customer, vehicles, appointments } = await fetchCustomerForTrash(id)
      if (customer) {
        await moveToTrash({
          entityType: 'customer',
          entityId: id,
          entityLabel: customer.name || 'Клиент',
          entityData: { customer, vehicles, appointments },
          stoCompanyId: profile?.sto_company_id,
        })
      }
      await deleteCustomer(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'], exact: false })
      toast.success('Клиент удален')
    },
    onError: (error: any) => {
      console.error('Delete mutation error:', error)
      toast.error('Ошибка при удалении: ' + (error.message || 'Недостаточно прав'))
    },
  })

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    const ok = await showConfirm({ message: 'Вы уверены? Будут удалены клиент, все его автомобили и заявки.', danger: true })
    if (!ok) return
    deleteMutation.mutate(id)
  }
  /* const handleCopyPublicLink = async (customerId: string) => {
    const publicUrl = `${window.location.origin}/public/customer/${customerId}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Ссылка скопирована в буфер обмена')
    } catch (err) {
      toast.error('Не удалось скопировать ссылку')
    }
  } */

  return (
    <div className="container-mobile">
      <PageHeader
        title="Клиенты"
        subtitle="База клиентов СТО"
        actions={
          <button
            onClick={() => {
              if (!canCreate.customer()) { setShowUpgrade(true); return }
              setEditingCustomer(null); setIsModalOpen(true)
            }}
            className="btn-primary btn-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Добавить</span>
            <span className="sm:hidden">Клиент</span>
          </button>
        }
      />

      {/* Поиск */}
      <div className="relative mb-4 sm:mb-6 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск по имени, телефону..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Desktop таблица */}
          <div className="hidden md:block card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Имя
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Контакты
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Автомобили
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата добавления
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers?.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link 
                          to={`/customer/${customer.id}`}
                          className="text-sm font-medium text-primary hover:text-primary/80 hover:underline"
                        >
                          {customer.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="w-4 h-4 mr-2" />
                            {customer.phone}
                          </div>
                          {customer.email && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="w-4 h-4 mr-2" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(customer.vehicles_count ?? 0) > 0 ? (
                          <button
                            onClick={() => navigate(`/vehicles?customer_id=${customer.id}`)}
                            className="flex items-center text-primary hover:text-primary/80"
                          >
                            <Car className="w-4 h-4 mr-2" />
                            <span className="font-semibold">{customer?.vehicles_count ?? 0}</span>
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(customer.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="text-primary hover:text-primary/80 mr-3"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile карточки */}
          <div className="md:hidden space-y-2.5">
            {filteredCustomers?.map((customer) => (
              <div key={customer.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Заголовок карточки */}
                <div className="bg-gradient-to-r from-blue-50 to-white px-3 py-2 border-b border-gray-100">
                  <Link 
                    to={`/customer/${customer.id}`}
                    className="text-base font-semibold text-gray-900 hover:text-primary block"
                  >
                    {customer.name}
                  </Link>
                </div>

                {/* Основная информация */}
                <div className="p-3 space-y-2.5">
                  {/* Телефон */}
                  <a 
                    href={`tel:${customer.phone}`} 
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Phone className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium">{customer.phone}</span>
                  </a>

                  {/* Автомобили и дата */}
                  <div className="flex items-center justify-between pt-1">
                    {(customer.vehicles_count ?? 0) > 0 ? (
                      <button
                        onClick={() => navigate(`/vehicles?customer_id=${customer.id}`)}
                        className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                          <Car className="w-4 h-4 text-blue-700" />
                        </div>
                        <span className="font-medium">Авто: {customer?.vehicles_count ?? 0}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                          <Car className="w-4 h-4 text-gray-400" />
                        </div>
                        <span>Нет авто</span>
                      </div>
                    )}

                    <span className="text-xs text-gray-400">
                      {new Date(customer.created_at).toLocaleDateString('ru-RU', { 
                        day: '2-digit', 
                        month: 'short',
                        year: 'numeric' 
                      }).replace(' г.', '')}
                    </span>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="px-3 py-2 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-blue-50 rounded transition-colors font-medium"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Изменить</span>
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(customer.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Удалить</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isModalOpen && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      <ConfirmDialog {...dialogProps} />

      <SubscriptionUpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        context="customers"
        currentPlan={plan?.name}
        used={usage.customers}
        limit={limits.maxCustomers ?? 0}
      />
    </div>
  )
}

function CustomerModal({ customer, onClose }: CustomerModalProps) {
  const { data: profile } = useUserProfile()
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    notes: customer?.notes || '',
  })

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (customer) {
        await updateCustomer(customer.id, data)
      } else {
        await createCustomer(data, profile?.sto_company_id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'], exact: false })
      toast.success(customer ? 'Клиент обновлен' : 'Клиент добавлен')
      onClose()
    },
    onError: () => {
      toast.error('Ошибка при сохранении')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      title={customer ? 'Редактировать клиента' : 'Добавить клиента'}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Имя *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Телефон *</label>
          <IMaskInput
            mask="+380 (00) 000-00-00"
            value={formData.phone}
            unmask={false}
            onAccept={(value) => setFormData({ ...formData, phone: value })}
            type="tel"
            required
            placeholder="+380 (XX) XXX-XX-XX"
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Заметки</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="form-input resize-none"
          />
        </div>
        {/* скрытая кнопка для submit по Enter */}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
