import { useState } from 'react'
import { Plus, Search, Users, Grid, List, ArrowLeft, Phone, Mail, TrendingUp, DollarSign, Link2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsCustomers, createPartsCustomer, updatePartsCustomer, deletePartsCustomer } from '@/services/partsService'
import PartsCustomerModal from '@/components/parts/PartsCustomerModal'
import type { PartsCustomer, CreatePartsCustomerInput } from '@/types/parts'

type ViewMode = 'grid' | 'list'

export default function PartsCustomers() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
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
    onError: (error: any) => {
      console.error('Delete parts customer mutation error:', error)
      toast.error('Ошибка при удалении: ' + (error.message || 'Недостаточно прав'))
    }
  })

  const filteredCustomers = customers.filter(customer => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      customer.full_name.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    )
  })

  // Statistics
  const stats = {
    total: customers.length,
    withOrders: customers.filter(c => c.total_orders > 0).length,
    totalSpent: customers.reduce((sum, c) => sum + c.total_spent, 0),
    avgSpent: customers.length > 0 ? customers.reduce((sum, c) => sum + c.total_spent, 0) / customers.length : 0,
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' ₴'
  }

  const handleEdit = (customer: PartsCustomer, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCustomer(customer)
    setIsModalOpen(true)
  }

  const handleDelete = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Удалить клиента? Это действие нельзя отменить.')) {
      deleteMutation.mutate(customerId)
    }
  }

  const handleCopyPublicLink = async (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const publicUrl = `${window.location.origin}/public/parts-customer/${customerId}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Публичная ссылка скопирована в буфер обмена', { duration: 2000 })
    } catch (err) {
      toast.error('Не удалось скопировать ссылку')
    }
  }

  const handleViewProfile = (customerId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    navigate(`/parts/customers/${customerId}`)
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">У вас нет доступа к разборке</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => navigate('/parts')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Клиенты</h1>
                <p className="text-sm text-gray-500 hidden sm:block">Всего: {stats.total}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null)
                setIsModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Добавить</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Всего клиентов</p>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">С заказами</p>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.withOrders}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Общая выручка</p>
              <DollarSign className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-blue-600">{formatCurrency(stats.totalSpent)}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Средний чек</p>
              <DollarSign className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-purple-600">{formatCurrency(stats.avgSpent)}</p>
          </div>
        </div>

        {/* Search & View Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по имени, телефону, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Customers List/Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery ? 'Клиенты не найдены' : 'Нет клиентов'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-primary hover:underline"
              >
                Добавить первого клиента
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden group"
              >
                <div className="p-5">
                  {/* Customer Name */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 mb-1 truncate group-hover:text-primary transition-colors">
                        {customer.full_name}
                      </h3>
                      {customer.discount_percent > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Скидка {customer.discount_percent}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <a href={`tel:${customer.phone}`} className="hover:text-primary truncate">
                          {customer.phone}
                        </a>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <a href={`mailto:${customer.email}`} className="hover:text-primary truncate">
                          {customer.email}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500">Заказов</p>
                      <p className="text-lg font-semibold text-gray-900">{customer.total_orders}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Потрачено</p>
                      <p className="text-lg font-semibold text-primary">{formatCurrency(customer.total_spent)}</p>
                    </div>
                  </div>

                  {customer.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Примечание:</p>
                      <p className="text-sm text-gray-600 line-clamp-2">{customer.notes}</p>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="bg-gray-50 px-4 py-3 flex gap-2">
                  <button
                    onClick={(e) => handleViewProfile(customer.id, e)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    Просмотр
                  </button>
                  <button
                    onClick={(e) => handleCopyPublicLink(customer.id, e)}
                    className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Скопировать публичную ссылку"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleEdit(customer, e)}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={(e) => handleDelete(customer.id, e)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Клиент
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Контакты
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Заказов
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Потрачено
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr 
                      key={customer.id} 
                      onClick={() => handleViewProfile(customer.id)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">{customer.full_name}</div>
                          {customer.discount_percent > 0 && (
                            <span className="text-xs text-green-600">Скидка {customer.discount_percent}%</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <div className="text-sm space-y-1">
                          {customer.phone && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Phone className="w-3 h-3" />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[200px]">{customer.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">
                        {customer.total_orders}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-primary hidden sm:table-cell">
                        {formatCurrency(customer.total_spent)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleCopyPublicLink(customer.id, e)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Публичная ссылка"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleEdit(customer, e)}
                            className="text-primary hover:text-primary/80"
                          >
                            Изменить
                          </button>
                          <button
                            onClick={(e) => handleDelete(customer.id, e)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <PartsCustomerModal
          isOpen={isModalOpen}
          customer={selectedCustomer}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedCustomer(null)
          }}
          onSubmit={(data) => saveMutation.mutateAsync(data)}
        />
      )}
    </div>
  )
}
