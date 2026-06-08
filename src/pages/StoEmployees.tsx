import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, UserCog, Trash2, Edit, AlertTriangle, ChevronLeft, ChevronRight, ClipboardCheck, Wallet } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useNavigate } from 'react-router-dom'
import { fmtMoney } from '@/utils/money'
import {
  fetchStoEmployees,
  fetchEmployeeMonthlyStats,
  deactivateStoEmployee,
  updateStoEmployeeName,
  type StoEmployee,
} from '@/services/stoService'

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export default function StoEmployees() {
  const [editingEmployee, setEditingEmployee] = useState<StoEmployee | null>(null)
  const [deletingEmployee, setDeletingEmployee] = useState<StoEmployee | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: currentUserProfile } = useUserProfile()
  const isStoOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'sto_owner')
  const stoCompanyId = currentUserProfile?.sto_company_id

  const now = new Date()
  const [period, setPeriod] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() })
  const isCurrentMonth = period.y === now.getFullYear() && period.m === now.getMonth()
  const prevMonth = () => setPeriod(p => { const d = new Date(p.y, p.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const nextMonth = () => setPeriod(p => { const d = new Date(p.y, p.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['sto_employees', stoCompanyId],
    queryFn: () => fetchStoEmployees(stoCompanyId!),
    enabled: !!stoCompanyId && !!isStoOwner,
  })

  const { data: stats = {} } = useQuery({
    queryKey: ['sto_employee_stats', stoCompanyId, period.y, period.m],
    queryFn: () => fetchEmployeeMonthlyStats(stoCompanyId!, period.y, period.m),
    enabled: !!stoCompanyId && !!isStoOwner,
  })

  const deleteEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) => deactivateStoEmployee(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_employees'] })
      toast.success('Работник удален. Его заявки переназначены автоматически.')
    },
    onError: (error: Error) => toast.error(error.message || 'Ошибка при удалении работника'),
  })

  const totalClosed = Object.values(stats).reduce((s, v) => s + v.closedCount, 0)
  const totalEarned = Object.values(stats).reduce((s, v) => s + v.workSum, 0)

  if (!isStoOwner) {
    return (
      <div className="container-mobile">
        <EmptyState icon={AlertTriangle} title="Доступ только для владельца" description="Раздел «Сотрудники» доступен только владельцу СТО." />
      </div>
    )
  }

  return (
    <div className="container-mobile">
      <PageHeader
        title="Сотрудники СТО"
        subtitle="Работники и их результаты за месяц"
      />

      {/* Период + сводка */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={prevMonth} className="btn-icon" aria-label="Предыдущий месяц"><ChevronLeft className="w-5 h-5" /></button>
          <p className="font-bold text-gray-900">{MONTHS_RU[period.m]} {period.y}</p>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="btn-icon disabled:opacity-30" aria-label="Следующий месяц"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-xl bg-blue-50 p-3 text-center">
            <p className="text-xs text-gray-500">Закрыто заявок</p>
            <p className="text-2xl font-bold text-blue-700 tabular-nums">{totalClosed}</p>
          </div>
          <div className="rounded-xl bg-green-50 p-3 text-center">
            <p className="text-xs text-gray-500">Заработано (работы)</p>
            <p className="text-2xl font-bold text-green-700 tabular-nums">{fmtMoney(totalEarned)}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8 sm:py-12"><Spinner size="lg" /></div>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Пока нет работников"
          description="Работники найдут вас при регистрации, введя номер телефона вашего СТО"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {employees.map((employee) => {
            const st = stats[employee.id] || { closedCount: 0, workSum: 0 }
            return (
              <div key={employee.id} className="card p-4 flex flex-col">
                {/* Шапка */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                    {employee.full_name?.charAt(0) || employee.username?.charAt(0)?.toUpperCase() || 'W'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{employee.full_name || 'Без имени'}</h3>
                    <p className="text-xs text-gray-500 font-mono truncate">{employee.username}</p>
                  </div>
                </div>

                {/* Метрики за месяц */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-center">
                    <ClipboardCheck className="w-4 h-4 text-blue-400 mx-auto mb-0.5" />
                    <p className="text-lg font-bold tabular-nums text-gray-900 leading-none">{st.closedCount}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">закрыто заявок</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-center">
                    <Wallet className="w-4 h-4 text-green-500 mx-auto mb-0.5" />
                    <p className="text-base font-bold tabular-nums text-gray-900 leading-none">{fmtMoney(st.workSum)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">заработано</p>
                  </div>
                </div>

                {employee.phone && <p className="text-xs text-gray-500 mb-3">тел. {employee.phone}</p>}

                {/* Действия */}
                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => navigate(`/sto/employees/${employee.id}`)}
                    className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" /> Статистика
                  </button>
                  <button onClick={() => setEditingEmployee(employee)} className="btn-icon" title="Редактировать"><Edit className="w-4 h-4" /></button>
                  <button
                    onClick={() => setDeletingEmployee(employee)}
                    disabled={deleteEmployeeMutation.isPending}
                    className="btn-icon text-red-500 hover:bg-red-50 disabled:opacity-50"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

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
