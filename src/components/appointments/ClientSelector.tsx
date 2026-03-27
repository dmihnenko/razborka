import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Search, Plus, User, Phone } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { IMaskInput } from 'react-imask'

interface Props {
  selectedId: string
  onSelect: (id: string, customer: any) => void
}

export default function ClientSelector({ selectedId, onSelect }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newClientData, setNewClientData] = useState({ name: '', phone: '' })
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()

  const { data: customers, isLoading, error: queryError } = useQuery({
    queryKey: ['customers', profile?.sto_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('sto_company_id', profile?.sto_company_id)
        .order('name')
      
      if (error) {
        console.error('Ошибка загрузки клиентов:', error)
        throw error
      }
      return data
    },
    enabled: !!profile?.sto_company_id,
  })

  if (queryError) {
    console.error('Query error:', queryError)
  }

  const createMutation = useMutation({
    mutationFn: async (data: typeof newClientData) => {
      const { data: customer, error } = await supabase
        .from('customers')
        .insert([{
          name: data.name,
          phone: data.phone,
          sto_company_id: profile?.sto_company_id,
        }])
        .select()
        .single()
      
      if (error) throw error
      return customer
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Клиент добавлен')
      onSelect(customer.id, customer)
      setShowAddForm(false)
      setNewClientData({ name: '', phone: '' })
    },
    onError: () => {
      toast.error('Ошибка при добавлении клиента')
    },
  })

  const filteredCustomers = customers?.filter((c) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase().trim()
    return (
      c.name?.toLowerCase().includes(query) ||
      c.phone?.toLowerCase().includes(query)
    )
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(newClientData)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по имени или телефону..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Новый клиент
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-3">Добавить нового клиента</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Имя *
              </label>
              <input
                type="text"
                required
                value={newClientData.name}
                onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Иван Петров"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Телефон *
              </label>
              <IMaskInput
                mask="+380 (00) 000-00-00"
                value={newClientData.phone}
                unmask={false}
                onAccept={(value) => setNewClientData({ ...newClientData, phone: value })}
                type="tel"
                required
                placeholder="+380 (XX) XXX-XX-XX"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Сохранение...' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          {customers && customers.length > 0 && (
            <div className="text-sm text-gray-500 mb-2">
              Найдено: {filteredCustomers?.length || 0} из {customers.length} клиентов
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {filteredCustomers?.map((customer) => (
            <button
              key={customer.id}
              onClick={() => onSelect(customer.id, customer)}
              className={`p-4 text-left rounded-lg border-2 transition-all ${
                selectedId === customer.id
                  ? 'border-primary bg-blue-50 ring-2 ring-primary/20'
                  : 'border-gray-200 hover:border-primary hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${selectedId === customer.id ? 'bg-primary/10' : 'bg-gray-100'}`}>
                  <User className={`w-5 h-5 ${selectedId === customer.id ? 'text-primary' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{customer.name}</div>
                  {customer.phone && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                      <Phone className="w-3 h-3" />
                      {customer.phone}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
          </div>
        </>
      )}

      {!isLoading && filteredCustomers?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? 'Клиенты не найдены' : 'Нет клиентов. Добавьте первого клиента.'}
        </div>
      )}
    </div>
  )
}
