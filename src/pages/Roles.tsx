import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="kicker mb-1">Администрирование</p>
          <h1 className="page-title">Управление ролями</h1>
        </div>
        <button
          onClick={() => {
            setEditingRole(null)
            setIsModalOpen(true)
          }}
          className="cab-btn cab-btn-primary flex-shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          <span className="hidden sm:inline">Добавить роль</span>
          <span className="sm:hidden">Добавить</span>
        </button>
      </div>

      {/* ── Loading skeleton ───────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-start gap-3">
              <div className="icon-tile bg-gray-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-50 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!isLoading && (roles?.length ?? 0) === 0 && (
        <div className="card mt-4">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Shield className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
            </div>
            <p className="empty-state-title">Нет ролей</p>
            <p className="empty-state-text">Создайте первую роль, чтобы управлять правами доступа</p>
            <button
              onClick={() => { setEditingRole(null); setIsModalOpen(true) }}
              className="cab-btn cab-btn-primary mt-5"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Добавить роль
            </button>
          </div>
        </div>
      )}

      {/* ── Список ролей — карточки ────────────────────────────────── */}
      {!isLoading && (roles?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
          {roles?.map((role) => {
            const isSystem = role.name === 'admin' || role.name === 'user'
            return (
              <div key={role.id} className="card p-4 flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <div className="icon-tile flex-shrink-0" style={{ background: 'var(--cab-signal-weak)' }}>
                    <Shield className="w-[18px] h-[18px]" strokeWidth={1.5} style={{ color: 'var(--cab-signal)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{role.display_name}</span>
                      <span className={`badge ${role.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {role.is_active ? 'Активна' : 'Неактивна'}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-gray-500">{role.name}</span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => { setEditingRole(role); setIsModalOpen(true) }}
                      title="Редактировать"
                      className="btn-icon text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Edit2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    {!isSystem && (
                      <button
                        onClick={() => handleDelete(role.id, role.name)}
                        title="Удалить"
                        className="btn-icon text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
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
      )}

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
    <Modal
      isOpen
      onClose={onClose}
      title={role ? 'Редактировать роль' : 'Новая роль'}
      icon={
        <div className="icon-tile" style={{ background: 'var(--cab-signal-weak)' }}>
          <Shield className="w-[18px] h-[18px]" strokeWidth={1.5} style={{ color: 'var(--cab-signal)' }} />
        </div>
      }
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cab-btn cab-btn-secondary flex-1"
          >
            Отмена
          </button>
          <button
            type="submit"
            form="role-form"
            disabled={saveRole.isPending}
            className="cab-btn cab-btn-primary flex-1"
          >
            {saveRole.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form id="role-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Системное имя (латиница)</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            disabled={!!role}
            className="form-input disabled:bg-gray-100"
            autoFocus={!role}
            required
          />
        </div>

        <div>
          <label className="form-label">Отображаемое название</label>
          <input
            type="text"
            value={formData.display_name}
            onChange={(e) =>
              setFormData({ ...formData, display_name: e.target.value })
            }
            className="form-input"
            autoFocus={!!role}
            required
          />
        </div>

        <div>
          <label className="form-label">Описание</label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="form-input resize-none"
            rows={3}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) =>
              setFormData({ ...formData, is_active: e.target.checked })
            }
            className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
            style={{ accentColor: 'var(--cab-signal)' }}
          />
          <span className="text-sm font-medium text-gray-700">Активная роль</span>
        </label>
      </form>
    </Modal>
  )
}
