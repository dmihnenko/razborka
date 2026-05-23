import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, Eye, UserCog, Trash2, Edit } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate } from 'react-router-dom'
import { IMaskInput } from 'react-imask'

interface Employee {
  id: string
  full_name: string | null
  username: string | null
  email: string
  phone: string | null
  created_at: string
}

export default function StoEmployees() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null)
  const navigate = useNavigate()
  const { data: currentUserProfile } = useUserProfile()

  // Загрузка работников СТО
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['sto_employees', currentUserProfile?.sto_company_id],
    queryFn: async () => {
      if (!currentUserProfile?.sto_company_id) return []

      // Получаем роль sto_worker
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'sto_worker')
        .single()

      if (roleError) throw roleError
      if (!roleData) return []

      // Сначала получаем все user_roles для роли sto_worker
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', roleData.id)

      if (userRolesError) throw userRolesError
      
      const userIds = userRolesData?.map(ur => ur.user_id) || []
      
      if (userIds.length === 0) return []

      // Теперь получаем профили этих пользователей, отфильтрованные по СТО
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('sto_company_id', currentUserProfile.sto_company_id)
        .eq('is_active', true)
        .in('id', userIds)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Employee[]
    },
    enabled: !!currentUserProfile?.sto_company_id
  })

  const queryClient = useQueryClient()

  // Мутация для удаления работника
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      // Деактивируем пользователя вместо удаления
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', employeeId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_employees'] })
      toast.success('Работник удален. Его заявки переназначены автоматически.')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при удалении работника')
    }
  })

  const handleDeleteEmployee = (employee: Employee) => {
    setDeletingEmployee(employee)
  }

  return (
    <div className="container-mobile">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Сотрудники СТО</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Управление работниками вашего СТО</p>
        </div>
        <div className="flex gap-2 sm:gap-3 flex-wrap">
          {employees.length > 0 && (
            <button
              onClick={() => setIsBulkAssignModalOpen(true)}
              className="btn-touch-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <UserCog className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Назначить заявки</span>
              <span className="sm:hidden">Назначить</span>
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-touch-sm bg-primary text-white hover:bg-primary/90 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Добавить работника</span>
            <span className="sm:hidden">Добавить</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8 sm:py-12">
          <Spinner size="lg" />
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
          <UserCog className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Нет работников</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4">Добавьте первого работника для вашего СТО</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-touch-sm bg-primary text-white hover:bg-primary/90 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Добавить работника
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {employees.map((employee) => (
            <div
              key={employee.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 sm:p-6"
            >
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-base sm:text-lg">
                    {employee.full_name?.charAt(0) || employee.username?.charAt(0)?.toUpperCase() || 'W'}
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                      {employee.full_name || 'Без имени'}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500">Работник СТО</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Логин:</span>
                  <span className="font-mono font-semibold text-gray-900">{employee.username}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Пароль:</span>
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-900">
                  </span>
                </div>
                {employee.phone && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Телефон:</span>
                    <span className="text-gray-900">{employee.phone}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate(`/sto/employees/${employee.id}`)}
                className="w-full flex items-center justify-center px-4 py-2 text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
              >
                <Eye className="w-4 h-4 mr-2" />
                Просмотр статистики
              </button>

              <button
                onClick={() => setEditingEmployee(employee)}
                className="w-full mt-2 flex items-center justify-center px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Редактировать
              </button>

              <button
                onClick={() => handleDeleteEmployee(employee)}
                disabled={deleteEmployeeMutation.isPending}
                className="w-full mt-2 flex items-center justify-center px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteEmployeeMutation.isPending ? 'Удаление...' : 'Удалить работника'}
              </button>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && currentUserProfile?.sto_company_id && (
        <AddEmployeeModal
          onClose={() => setIsModalOpen(false)}
          stoCompanyId={currentUserProfile.sto_company_id}
        />
      )}

      <BulkAssignModal
        isOpen={isBulkAssignModalOpen}
        onClose={() => setIsBulkAssignModalOpen(false)}
        employees={employees}
      />

      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
        />
      )}

      {deletingEmployee && (
        <DeleteEmployeeConfirmModal
          employee={deletingEmployee}
          onClose={() => setDeletingEmployee(null)}
          onConfirm={() => {
            deleteEmployeeMutation.mutate(deletingEmployee.id)
            setDeletingEmployee(null)
          }}
        />
      )}
    </div>
  )
}

function AddEmployeeModal({ onClose, stoCompanyId }: { onClose: () => void; stoCompanyId: string }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: ''
  })
  const queryClient = useQueryClient()

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Проверяем, не существует ли уже пользователь с таким username
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', data.username)
        .maybeSingle()

      if (existingUser) {
        throw new Error(`Пользователь с логином "${data.username}" уже существует`)
      }

      // Генерируем email-заглушку с валидным доменом
      const email = `${data.username}@sto-worker.local`

      // Создаем пользователя в auth с минимальными данными
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: data.password
      })

      if (authError) {
        console.error('Auth signup error:', authError)
        // Более понятное сообщение об ошибке
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          throw new Error('Email уже зарегистрирован. Попробуйте другой логин.')
        }
        throw new Error(authError.message || 'Ошибка создания пользователя')
      }

      if (!authData.user) {
        throw new Error('Не удалось создать пользователя')
      }

      const userId = authData.user.id

      // Даем время триггеру создать базовый профиль
      await new Promise(resolve => setTimeout(resolve, 500))

      // Обновляем или создаем профиль
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          username: data.username,
          full_name: data.full_name || null,
          phone: data.phone || null,
          sto_company_id: stoCompanyId || null,
          parts_company_id: null,
          email: email,
          is_active: true
        })

      if (profileError) {
        console.error('Profile error:', profileError)
        throw profileError
      }

      // Получаем role_id для sto_worker
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'sto_worker')
        .single()

      if (!roleData) throw new Error('Role not found')

      // Добавляем роль (если уже есть - игнорируем)
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role_id: roleData.id,
          is_primary: true
        }, {
          onConflict: 'user_id,role_id'
        })

      if (roleError) throw roleError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_employees', stoCompanyId] })
      toast.success('Работник добавлен')
      onClose()
    },
    onError: (error: any) => {
      toast.error('Ошибка при добавлении: ' + error.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.username || !formData.password) {
      toast.error('Заполните обязательные поля')
      return
    }
    createEmployeeMutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Добавить работника</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Логин (username) *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="worker1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Пароль *
            </label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Минимум 6 символов"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Пароль будет виден в списке работников</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ФИО
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Иванов Иван Иванович"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Телефон
            </label>
            <IMaskInput
              mask="+380 (00) 000-00-00"
              value={formData.phone}
              onAccept={(value) => setFormData({ ...formData, phone: value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="+380 (XX) XXX-XX-XX"
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createEmployeeMutation.isPending}
              className="px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {createEmployeeMutation.isPending ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Модальное окно для массового назначения заявок
function BulkAssignModal({ isOpen, onClose, employees }: { isOpen: boolean; onClose: () => void; employees: Employee[] }) {
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const queryClient = useQueryClient()

  const bulkAssignMutation = useMutation({
    mutationFn: async (workerId: string) => {
      const worker = employees.find(e => e.id === workerId)
      
      const { error } = await supabase
        .from('appointments')
        .update({
          assigned_to: workerId,
          assigned_to_name: worker?.full_name || worker?.username || null
        })
        .is('assigned_to', null)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Заявки успешно назначены работнику')
      onClose()
      setSelectedWorkerId('')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при назначении заявок')
    }
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Массовое назначение заявок
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          Выберите работника, которому будут назначены все незакрепленные заявки (включая архивные).
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Работник
          </label>
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Выберите работника</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name || employee.username}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Отмена
          </button>
          <button
            onClick={() => bulkAssignMutation.mutate(selectedWorkerId)}
            disabled={!selectedWorkerId || bulkAssignMutation.isPending}
            className="px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkAssignMutation.isPending ? 'Назначение...' : 'Назначить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Модальное окно для редактирования сотрудника
function EditEmployeeModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [fullName, setFullName] = useState(employee.full_name || '')
  const queryClient = useQueryClient()

  const updateEmployeeMutation = useMutation({
    mutationFn: async (newFullName: string) => {
      // Обновляем имя в user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ full_name: newFullName })
        .eq('id', employee.id)
      
      if (profileError) throw profileError

      // Обновляем assigned_to_name во всех активных заявках
      const { error: appointmentsError } = await supabase
        .from('appointments')
        .update({ assigned_to_name: newFullName })
        .eq('assigned_to', employee.id)
        .neq('status', 'archived')
        .neq('status', 'completed')
        .neq('status', 'cancelled')
      
      if (appointmentsError) throw appointmentsError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_employees'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Данные работника обновлены')
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при обновлении данных')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Введите имя работника')
      return
    }
    updateEmployeeMutation.mutate(fullName.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Редактировать работника
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Логин
            </label>
            <input
              type="text"
              value={employee.username || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Полное имя <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Введите полное имя"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={updateEmployeeMutation.isPending || !fullName.trim()}
              className="px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateEmployeeMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Модальное окно подтверждения удаления работника
function DeleteEmployeeConfirmModal({ 
  employee, 
  onClose, 
  onConfirm 
}: { 
  employee: Employee; 
  onClose: () => void; 
  onConfirm: () => void 
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          Удаление работника
        </h2>

        <div className="mb-6">
          <p className="text-gray-900 mb-3">
            Вы действительно хотите удалить работника{' '}
            <span className="font-semibold">{employee.full_name || employee.username}</span>?
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>Важно:</strong> Его активные заявки будут автоматически:
            </p>
            <ul className="list-disc list-inside text-sm text-yellow-800 mt-2 space-y-1">
              <li>Переназначены другому работнику, если он один в системе</li>
              <li>Сняты с назначения, если работников несколько или нет</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-white bg-red-700 rounded-md hover:bg-red-800"
          >
            Удалить работника
          </button>
        </div>
      </div>
    </div>
  )
}
