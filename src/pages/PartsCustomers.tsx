import { useState } from 'react'
import { Plus, Search, User, Edit, Trash2, Phone as PhoneIcon, Mail } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsCustomers, createPartsCustomer, updatePartsCustomer, deletePartsCustomer } from '@/services/partsService'
import PartsCustomerModal from '@/components/parts/PartsCustomerModal'
import type { PartsCustomer, CreatePartsCustomerInput } from '@/types/parts'

export default function PartsCustomers() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<PartsCustomer | null>(null)
  
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['parts-customers', partsCompanyId],
    queryFn: () => getPartsCustomers(partsCompanyId!),
    enabled: !!partsCompanyId
  })

  const saveMutation = useMutation({
    mutationFn: async (data: CreatePartsCustomerInput) => {
      if (selectedCustomer) {
        return updatePartsCustomer(selectedCustomer.id, data)
      } else {
        return createPartsCustomer(data, partsCompanyId!)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      toast.success(selectedCustomer ? 'Клиент обновлён' : 'Клиент добавлен')
      setIsModalOpen(false)
      setSelectedCustomer(null)
    },
    onError: () => {
      toast.error('Ошибка при сохранении')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deletePartsCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      toast.success('Клиент удалён')
    },
    onError: () => {
      toast.error('Ошибка при удалении')
    }
  })

  const filteredCustomers = customers.filter(customer =>
    searchQuery === '' ||
    customer.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = (customer: PartsCustomer) => {
    if (confirm(`Удалить клиента ${customer.full_name}?`)) {
      deleteMutation.mutate(customer.id)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Клиенты разборки</h1>
          <p className="text-gray-600 mt-2">Управление клиентами авторазборки</p>
        </div>
        <button 
          onClick={() => {
            setSelectedCustomer(null)
            setIsModalOpen(true)
          }}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus size={20} />
          Добавить клиента
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <User className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Всего клиентов</p>
              <p className="text-2xl font-bold">{customers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full">
              <User className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">С заказами</p>
              <p className="text-2xl font-bold">{customers.filter(c => c.total_orders > 0).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-full">
              <User className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Общая сумма</p>
              <p className="text-2xl font-bold">₴{customers.reduce((sum, c) => sum + c.total_spent, 0).toFixed(0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Поиск по имени, телефону, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <User className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="text-lg">Нет клиентов</p>
              <p className="text-sm mt-2">Добавьте первого клиента разборки</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">{customer.full_name}</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        {customer.phone && (
                          <div className="flex items-center gap-2">
                            <PhoneIcon size={14} />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={14} />
                            <span>{customer.email}</span>
                          </div>
                        )}
                        {customer.discount_percent > 0 && (
                          <div>
                            <span className="font-medium">Скидка:</span> {customer.discount_percent}%
                          </div>
                        )}
                      </div>

                      <div className="mt-2 text-sm text-gray-500">
                        Заказов: {customer.total_orders} | Потрачено: ₴{customer.total_spent}
                      </div>

                      {customer.notes && (
                        <p className="mt-2 text-sm text-gray-500">{customer.notes}</p>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setIsModalOpen(true)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Редактировать"
                      >
                        <Edit size={18} />
                      </button>

                      <button
                        onClick={() => handleDelete(customer)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PartsCustomerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedCustomer(null)
        }}
        onSubmit={async (data) => {
          await saveMutation.mutateAsync(data)
        }}
        customer={selectedCustomer}
      />
    </div>
  )
}
