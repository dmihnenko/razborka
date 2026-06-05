import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, UserCog, Trash2, Edit, AlertTriangle } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useNavigate } from 'react-router-dom'
import {
  fetchStoEmployees,
  deactivateStoEmployee,
  updateStoEmployeeName,
  bulkAssignAppointments,
  type StoEmployee,
} from '@/services/stoService'

export default function StoEmployees() {
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<StoEmployee | null>(null)
  const [deletingEmployee, setDeletingEmployee] = useState<StoEmployee | null>(null)
  const navigate = useNavigate()
  const { data: currentUserProfile } = useUserProfile()

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['sto_employees', currentUserProfile?.sto_company_id],
    queryFn: () => fetchStoEmployees(currentUserProfile!.sto_company_id),
    enabled: !!currentUserProfile?.sto_company_id,
  })

  const queryClient = useQueryClient()

  const deleteEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) => deactivateStoEmployee(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_employees'] })
      toast.success('Работник удален. Его заявки переназначены автоматически.')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при удалении работника')
    }
  })

  const handleDeleteEmployee = (employee: StoEmployee) => {
    setDeletingEmployee(employee)
  }

  return (
    <div className="container-mobile">
      <PageHeader
        title="Сотрудники СТО"
        subtitle="Управление работниками вашего СТО"
        actions={employees.length > 0 && (
          <button
            onClick={() => setIsBulkAssignModalOpen(true)}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            <UserCog className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Назначить заявки</span>
            <span className="sm:hidden">Назначить</span>
          </button>
        )}
      />

      {isLoading ? (
        <div className="flex justify-center py-8 sm:py-12">
          <Spinner size="lg" />
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Пока нет работников"
          description="Работники найдут вас при регистрации, введя номер телефона вашего СТО"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
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

function BulkAssignModal({ isOpen, onClose, employees }: { isOpen: boolean; onClose: () => void; employees: StoEmployee[] }) {
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const queryClient = useQueryClient()

  const bulkAssignMutation = useMutation({
    mutationFn: (workerId: string) => {
      const worker = employees.find(e => e.id === workerId)
      return bulkAssignAppointments(workerId, worker?.full_name || worker?.username || null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Заявки успешно назначены работнику')
      onClose()
      setSelectedWorkerId('')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при назначении заявок')
    }
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      icon={<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><UserCog className="w-5 h-5 text-primary" /></div>}
      title="Массовое назначение заявок"
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
            onClick={() => bulkAssignMutation.mutate(selectedWorkerId)}
            disabled={!selectedWorkerId || bulkAssignMutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {bulkAssignMutation.isPending ? 'Назначение…' : 'Назначить'}
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-600 mb-4">
        Выберите работника, которому будут назначены все незакреплённые заявки (включая архивные).
      </p>
      <label className="form-label">Работник</label>
      <select
        value={selectedWorkerId}
        onChange={(e) => setSelectedWorkerId(e.target.value)}
        className="form-select"
      >
        <option value="">Выберите работника</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.full_name || employee.username}
          </option>
        ))}
      </select>
    </Modal>
  )
}

function EditEmployeeModal({ employee, onClose }: { employee: StoEmployee; onClose: () => void }) {
  const [fullName, setFullName] = useState(employee.full_name || '')
  const queryClient = useQueryClient()

  const updateEmployeeMutation = useMutation({
    mutationFn: (newFullName: string) => updateStoEmployeeName(employee.id, newFullName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_employees'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Данные работника обновлены')
      onClose()
    },
    onError: (error: Error) => {
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
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      icon={<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Edit className="w-5 h-5 text-primary" /></div>}
      title="Редактировать работника"
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
            disabled={updateEmployeeMutation.isPending || !fullName.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {updateEmployeeMutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Логин</label>
          <input
            type="text"
            value={employee.username || ''}
            disabled
            className="form-input bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="form-label">Полное имя <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Введите полное имя"
            className="form-input"
            autoFocus
          />
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

function DeleteEmployeeConfirmModal({ 
  employee, 
  onClose, 
  onConfirm 
}: { 
  employee: StoEmployee; 
  onClose: () => void; 
  onConfirm: () => void 
}) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      hideClose
      icon={<div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>}
      title="Удаление работника"
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
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Удалить работника
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-700 mb-3">
        Вы действительно хотите удалить работника{' '}
        <span className="font-semibold">{employee.full_name || employee.username}</span>?
      </p>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-800">
          <strong>Важно:</strong> Его активные заявки будут автоматически:
        </p>
        <ul className="list-disc list-inside text-sm text-yellow-800 mt-2 space-y-1">
          <li>Переназначены другому работнику, если он один в системе</li>
          <li>Сняты с назначения, если работников несколько или нет</li>
        </ul>
      </div>
    </Modal>
  )
}
