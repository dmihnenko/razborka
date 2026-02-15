import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Phone, Mail, Car, Search } from 'lucide-react'
import InputMask from 'react-input-mask'
import { useNavigate, Link } from 'react-router-dom'
import { useHasAnyRole } from '@/hooks/useUserProfile'

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
  const handleCopyPublicLink = async (customerId: string) => {
    const publicUrl = `${window.location.origin}/public/customer/${customerId}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Ссылка скопирована в буфер обмена')
    } catch (err) {
      toast.error('Не удалось скопировать ссылку')
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Клиенты</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по имени, телефону, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent w-80"
            />
          </div>
          <button
            onClick={() => {
              setEditingCustomer(null)
              setIsModalOpen(true)
            }}
            className="flex items-center px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90"
          >
            <Plus className="w-5 h-5 mr-2" />
            Добавить клиента
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {customer ? 'Редактировать клиента' : 'Добавить клиента'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Имя *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Телефон *</label>
            <InputMask
              mask="+380 (99) 999-99-99"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            >
              {(inputProps: any) => (
                <input
                  {...inputProps}
                  type="tel"
                  required
                  placeholder="+380 (XX) XXX-XX-XX"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              )}
            </InputMask>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Заметки</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
