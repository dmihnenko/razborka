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
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Управление ролями</h1>
        <button
          onClick={() => {
            setEditingRole(null)
            setIsModalOpen(true)
          }}
          className="btn-touch-sm bg-blue-700 text-white hover:bg-blue-800 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Добавить</span>
          <span className="sm:hidden">+</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Отображаемое имя
                </th>
                <th className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Описание
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {roles?.map((role) => (
              <tr key={role.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-blue-600" />
                    <span className="font-mono text-sm">{role.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">
                    {role.display_name}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">
                    {role.description || '-'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      role.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {role.is_active ? 'Активна' : 'Неактивна'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => {
                      setEditingRole(role)
                      setIsModalOpen(true)
                    }}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    <Edit2 size={18} />
                  </button>
                  {role.name !== 'admin' && role.name !== 'user' && (
                    <button
                      onClick={() => handleDelete(role.id, role.name)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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
              className="flex-1 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800"
            >
              Сохранить
            </button>
            
          </div>
        </form>
      </div>
    </div>
  )
}
