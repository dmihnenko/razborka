import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  type Role,
  type RoleFormData,
} from '@/services/rolesService'

export default function Roles() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Роль удалена')
    },
    onError: (error: Error) => {
      toast.error('Ошибка при удалении роли: ' + error.message)
    },
  })

  const handleDelete = async (id: string, name: string) => {
    if (name === 'admin' || name === 'user') {
      toast.error('Системные роли нельзя удалить')
      return
    }
    const ok = await showConfirm({ message: 'Удалить роль? Пользователи с этой ролью потеряют свои права.', danger: true })
    if (!ok) return
    deleteRoleMutation.mutate(id)
  }

  if (isLoading) {
    return <div className="p-8">Загрузка...</div>
  }

  return (
    <div className="container-mobile">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <h1 className="page-title">Управление ролями</h1>
        <button
          onClick={() => {
            setEditingRole(null)
            setIsModalOpen(true)
          }}
          className="cab-btn cab-btn-primary cab-btn-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Добавить</span>
          <span className="sm:hidden">+</span>
        </button>
      </div>

      {/* Список ролей — карточки, адаптивно на всех экранах */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles?.map((role) => {
          const isSystem = role.name === 'admin' || role.name === 'user'
          return (
            <div key={role.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Shield size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{role.display_name}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${role.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {role.is_active ? 'Активна' : 'Неактивна'}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-gray-400">{role.name}</span>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => { setEditingRole(role); setIsModalOpen(true) }}
                    title="Редактировать"
                    className="p-2.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  {!isSystem && (
                    <button
                      onClick={() => handleDelete(role.id, role.name)}
                      title="Удалить"
                      className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              {role.description && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 pl-12">{role.description}</p>
              )}
            </div>
          )
        })}
      </div>

      {isModalOpen && (
        <RoleModal
          role={editingRole}
          onClose={() => {
            setIsModalOpen(false)
            setEditingRole(null)
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

function RoleModal({
  role,
  onClose,
}: {
  role: Role | null
  onClose: () => void
}) {
  const [formData, setFormData] = useState<RoleFormData>({
    name: role?.name || '',
    display_name: role?.display_name || '',
    description: role?.description || '',
    is_active: role?.is_active ?? true,
  })
  const queryClient = useQueryClient()

  const saveRole = useMutation({
    mutationFn: async (data: RoleFormData) => {
      if (role) {
        await updateRole(role.id, data)
      } else {
        await createRole(data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success(role ? 'Роль обновлена' : 'Роль создана')
      onClose()
    },
    onError: (error: Error) => {
      toast.error('Ошибка: ' + error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveRole.mutate(formData)
  }

  return (
    <div className="modal-overlay">
      <div className="bg-white rounded-t-2xl sm:rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {role ? 'Редактировать роль' : 'Новая роль'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Системное имя (латиница)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              disabled={!!role}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Отображаемое название
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0 mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Активная роль
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Отмена
            </button><button
              type="submit"
              className="cab-btn cab-btn-primary flex-1"
            >
              Сохранить
            </button>
            
          </div>
        </form>
      </div>
    </div>
  )
}
