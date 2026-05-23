import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { Search, Users, Grid, List, UserCheck, UserX, Mail, Phone, Plus, X } from 'lucide-react'
import PartsPageHeader from '@/components/parts/PartsPageHeader'

type ViewMode = 'grid' | 'list'

export default function PartsEmployees() {
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addEmployeeEmail, setAddEmployeeEmail] = useState('')

  // Получить список сотрудников разборки
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['parts-employees', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return []

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('parts_company_id', partsCompanyId)
        .order('full_name')

      if (error) throw error
      return data || []
    },
    enabled: !!partsCompanyId,
  })

  // Фильтрация по поиску
  const filteredEmployees = employees.filter(emp => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      emp.full_name?.toLowerCase().includes(query) ||
      emp.username?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query) ||
      emp.phone?.includes(query)
    )
  })


  // Мутация для добавления сотрудника
  const addEmployeeMutation = useMutation({
    mutationFn: async (email: string) => {
      // Найти пользователя по email
      const { data: users, error: searchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .limit(1)

      if (searchError) throw searchError
      if (!users || users.length === 0) {
        throw new Error('Пользователь с таким email не найден')
      }

      const user = users[0]

      // Проверить, не назначен ли уже
      if (user.parts_company_id === partsCompanyId) {
        throw new Error('Этот пользователь уже работает в вашей разборке')
      }

      if (user.parts_company_id) {
        throw new Error('Этот пользователь уже работает в другой разборке')
      }

      // Назначить пользователя в разборку
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ parts_company_id: partsCompanyId })
        .eq('id', user.id)

      if (updateError) throw updateError

      return user
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-employees'] })
      setShowAddModal(false)
      setAddEmployeeEmail('')
    },
  })

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault()
    if (addEmployeeEmail.trim()) {
      addEmployeeMutation.mutate(addEmployeeEmail)
    }
  }

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.email).length,
    withPhone: employees.filter(e => e.phone).length,
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title="Сотрудники"
        subtitle={`Всего: ${stats.total}`}
        backPath="/parts/dashboard"
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Добавить</span>
          </button>
        }
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Всего сотрудников</p>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">С email</p>
              <UserCheck className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.active}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">С телефоном</p>
              <Phone className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.withPhone}</p>
          </div>
        </div>

        {/* Search & View Controls */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по имени, email, телефону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${
                  viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-600'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-600'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Employees List/Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <Spinner size="md" className="inline-block" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery ? 'Сотрудники не найдены' : 'Нет сотрудников'}
            </p>
            {!searchQuery && (
              <p className="text-sm text-gray-400">Добавьте сотрудников через панель администратора</p>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-3 sm:p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {employee.full_name || 'Без имени'}
                    </h3>
                    {employee.username && (
                      <p className="text-sm text-gray-500">@{employee.username}</p>
                    )}
                  </div>
                  {employee.email ? (
                    <UserCheck className="w-5 h-5 text-green-500" />
                  ) : (
                    <UserX className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                <div className="space-y-2">
                  {employee.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{employee.email}</span>
                    </div>
                  )}
                  {employee.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{employee.phone}</span>
                    </div>
                  )}
                  {!employee.email && !employee.phone && (
                    <p className="text-sm text-gray-400">Нет контактной информации</p>
                  )}
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
                      Имя
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Username
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Телефон
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {employee.email ? (
                            <UserCheck className="w-4 h-4 text-green-500" />
                          ) : (
                            <UserX className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="font-medium text-gray-900">
                            {employee.full_name || 'Без имени'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">
                        {employee.username ? `@${employee.username}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 hidden lg:table-cell">
                        <div className="max-w-xs truncate">{employee.email || '—'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell">
                        {employee.phone || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Добавить сотрудника</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setAddEmployeeEmail('')
                  addEmployeeMutation.reset()
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email сотрудника
                </label>
                <input
                  type="email"
                  value={addEmployeeEmail}
                  onChange={(e) => setAddEmployeeEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Введите email пользователя, который уже зарегистрирован в системе
                </p>
              </div>

              {addEmployeeMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">
                    {addEmployeeMutation.error instanceof Error 
                      ? addEmployeeMutation.error.message 
                      : 'Ошибка при добавлении сотрудника'}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setAddEmployeeEmail('')
                    addEmployeeMutation.reset()
                  }}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={addEmployeeMutation.isPending || !addEmployeeEmail.trim()}
                  className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addEmployeeMutation.isPending ? 'Добавление...' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
