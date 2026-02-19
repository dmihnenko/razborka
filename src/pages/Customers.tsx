import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Phone, Mail, Car, Search } from 'lucide-react'
import { IMaskInput } from 'react-imask'
import { useNavigate, Link } from 'react-router-dom'
import { useHasAnyRole } from '@/hooks/useUserProfile'
import { useBlockScroll } from '@/hooks/useBlockScroll'

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

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error

      // Получаем количество автомобилей для каждого клиента
      const customersWithVehicles = await Promise.all(
        data.map(async (customer) => {
          const { count } = await supabase
            .from('vehicles')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id)
          
          return { ...customer, vehicles_count: count || 0 }
        })
      )
      
      return customersWithVehicles
    },
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
      const { error } = await supabase.from('customers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Клиент удален')
    },
    onError: () => {
      toast.error('Ошибка при удалении')
    },
  })

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить этого клиента?')) {
      deleteMutation.mutate(id)
    }
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
      {/* Search and Actions */}
      <div className="flex justify-end gap-3 mb-4 sm:mb-6 flex-wrap">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по имени, телефону..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 pl-9 sm:pl-10 pr-4 py-2 text-mobile-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setEditingCustomer(null)
            setIsModalOpen(true)
          }}
          className="btn-touch-sm bg-primary text-white hover:bg-primary/90 flex items-center gap-1.5 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Добавить</span>
          <span className="sm:hidden">Клиент</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Desktop таблица */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
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
                        {customer.vehicles_count > 0 ? (
                          <button
                            onClick={() => navigate(`/vehicles?customer_id=${customer.id}`)}
                            className="flex items-center text-primary hover:text-primary/80"
                          >
                            <Car className="w-4 h-4 mr-2" />
                            <span className="font-semibold">{customer.vehicles_count}</span>
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
                    {customer.vehicles_count > 0 ? (
                      <button
                        onClick={() => navigate(`/vehicles?customer_id=${customer.id}`)}
                        className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                          <Car className="w-4 h-4 text-blue-700" />
                        </div>
                        <span className="font-medium">Авто: {customer.vehicles_count}</span>
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
    </div>
  )
}

function CustomerModal({ customer, onClose }: CustomerModalProps) {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
  })

  useBlockScroll(true)

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (customer) {
        const { error } = await supabase
          .from('customers')
          .update(data)
          .eq('id', customer.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('customers').insert([data])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-bold">
            {customer ? 'Редактировать клиента' : 'Добавить клиента'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Имя *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Телефон *</label>
            <IMaskInput
              mask="+380 (00) 000-00-00"
              value={formData.phone}
              unmask={false}
              onAccept={(value) => setFormData({ ...formData, phone: value })}
              type="tel"
              required
              placeholder="+380 (XX) XXX-XX-XX"
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Адрес</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Заметки</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>
        </form>
        <div className="sticky bottom-0 bg-white px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 sm:py-3 text-sm sm:text-base text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium border-2 border-gray-300"
          >
            Отмена
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
          >
            {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
