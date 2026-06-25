import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, User, Lock, Building2, Shield, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getRoles } from '../services/userService'
import { getPartsCompanies } from '../services/companyService'
import { useIsAdmin, useUserProfile } from '@/hooks/useUserProfile'
import RoleSelector from '@/components/admin/RoleSelector'

interface UserFormData {
  email: string
  username: string
  password: string
  full_name: string
  phone: string
  role_ids: string[]
  primary_role_id: string
  parts_company_id: string
}

function getRoleBadgeClass(roleName?: string) {
  const classes: Record<string, string> = {
    admin: 'badge-red',
    parts_owner: 'badge-orange',
    parts_worker: 'badge-yellow',
    user: 'badge-gray',
  }
  return `badge ${classes[roleName || ''] || 'badge-gray'}`
}

function shouldShowPartsCompany(roleNames: string[]) {
  return roleNames.some(n => ['admin', 'parts_owner', 'parts_worker'].includes(n))
}

export default function UserCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = useIsAdmin()
  const { data: currentUserProfile } = useUserProfile()

  const isPartsOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'parts_owner') || false

  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    username: '',
    password: '',
    full_name: '',
    phone: '',
    role_ids: [],
    primary_role_id: '',
    parts_company_id: '',
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => getRoles()
  })

  // Автозаполнение компании И роли после загрузки профиля и ролей
  useEffect(() => {
    if (!currentUserProfile || roles.length === 0) return

    setFormData(prev => {
      const updates: Partial<UserFormData> = {}

      // Автоподставляем компанию
      if (isPartsOwner && !isAdmin && currentUserProfile.parts_company_id) {
        updates.parts_company_id = currentUserProfile.parts_company_id
      }

      // Автоподставляем роль работника если она ещё не выбрана
      if (prev.role_ids.length === 0) {
        const workerRole = roles.find(r => isPartsOwner && r.name === 'parts_worker')
        if (workerRole) {
          updates.role_ids = [workerRole.id]
          updates.primary_role_id = workerRole.id
        }
      }

      return { ...prev, ...updates }
    })
  }, [currentUserProfile, roles, isPartsOwner, isAdmin])
  const [showPassword, setShowPassword] = useState(false)

  const { data: partsCompanies = [] } = useQuery({
    queryKey: ['parts_companies'],
    queryFn: () => getPartsCompanies()
  })

  const allowedRoles = useMemo(() => {
    return roles.filter((role) => {
      if (role.name === 'user') return false
      if (isAdmin) return true
      if (isPartsOwner) return role.name === 'parts_worker'
      return false
    })
  }, [roles, isAdmin, isPartsOwner])

  const selectedRoleNames = useMemo(() => {
    return allowedRoles.filter(r => formData.role_ids.includes(r.id)).map(r => r.name)
  }, [allowedRoles, formData.role_ids])

  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email || null,
          password: data.password,
          full_name: data.full_name,
          phone: data.phone,
          username: data.username.toLowerCase(),
          role_ids: data.role_ids,
          primary_role_id: data.primary_role_id,
          parts_company_id: data.parts_company_id || null,
        }
      })
      if (fnError) throw new Error(fnError.message)
      if (fnData?.error) throw new Error(fnData.error)
    },
    onSuccess: async (_, variables) => {
      // Notify admins about user creation
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-user-registered`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                userId: '', // We don't have the ID yet
                username: variables.username.toLowerCase(),
                email: variables.email,
                fullName: variables.full_name,
              }),
            }
          ).catch(err => console.error('Failed to send notification:', err))
        }
      } catch (err) {
        console.error('Error preparing notification:', err)
      }

      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      toast.success('Пользователь создан')
      navigate(-1) // возвращаемся туда откуда пришли (users или admin/users)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при создании пользователя')
    }
  })

  const needsPartsCompany = selectedRoleNames.some(n => ['parts_owner', 'parts_worker'].includes(n))
  const isValid = formData.username.trim().length >= 2
    && formData.password.length >= 6
    && formData.role_ids.length > 0
    && !!formData.primary_role_id
    && (!needsPartsCompany || !!formData.parts_company_id)

  return (
    <div className="min-h-dvh bg-[var(--cab-bg)]">
      {/* Хедер */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                <span className="truncate">Пользователи</span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold text-gray-900 truncate">Новый пользователь</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors hidden sm:block"
              >
                Отмена
              </button>
              <button
                onClick={() => createMutation.mutate(formData)}
                disabled={!isValid || createMutation.isPending}
                className="cab-btn cab-btn-primary disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Создание...</>
                ) : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Контент */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Левая колонка — основная форма */}
          <div className="lg:col-span-2 space-y-4">

            {/* Доступ в систему */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="icon-tile-sm" style={{ background: 'var(--cab-signal-weak)' }}>
                  <Lock className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--cab-signal)' }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Доступ в систему</h2>
                  <p className="text-xs text-gray-500">Логин и пароль для входа</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="form-label">
                    Логин <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    className="form-input"
                    placeholder="username"
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-500 mt-1">Основной идентификатор для входа</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">
                      Пароль <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="form-input pr-10"
                        placeholder="Минимум 6 символов"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                    {formData.password.length > 0 && formData.password.length < 6 && (
                      <p className="form-error">Минимум 6 символов</p>
                    )}
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="form-input"
                      placeholder="user@example.com"
                      autoComplete="off"
                    />
                    <p className="text-xs text-gray-500 mt-1">Опционально, для восстановления</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Профиль */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="icon-tile-sm bg-blue-50">
                  <User className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Профиль</h2>
                  <p className="text-xs text-gray-500">Контактные данные</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="form-label">ФИО</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    className="form-input"
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
                <div>
                  <label className="form-label">Телефон</label>
                  <IMaskInput
                    mask="+380 00 000-00-00"
                    value={formData.phone}
                    onAccept={v => setFormData({ ...formData, phone: String(v) })}
                    className="form-input"
                    placeholder="+380 XX XXX-XX-XX"
                  />
                </div>
              </div>
            </div>

            {/* Привязка к компании */}
            {shouldShowPartsCompany(selectedRoleNames) && (
              <div className="card p-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                  <div className="icon-tile-sm bg-green-50">
                    <Building2 className="w-4 h-4 text-green-600" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Привязка к компании</h2>
                    <p className="text-xs text-gray-500">Организация пользователя</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {shouldShowPartsCompany(selectedRoleNames) && (
                    <div>
                      <label className="form-label">
                        Авторазборка {selectedRoleNames.some(n => ['parts_owner','parts_worker'].includes(n)) ? <span className="text-red-500">*</span> : ''}
                      </label>
                      <select
                        value={formData.parts_company_id}
                        onChange={e => setFormData({ ...formData, parts_company_id: e.target.value })}
                        disabled={isPartsOwner && !isAdmin}
                        className="form-input disabled:bg-gray-50"
                      >
                        <option value="">Выберите авторазборку</option>
                        {partsCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Правая колонка — роли */}
          <div className="space-y-4">
            <div className="card p-0 overflow-hidden lg:sticky lg:top-24">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="icon-tile-sm" style={{ background: 'var(--cab-signal-weak)' }}>
                  <Shield className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--cab-signal)' }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Роли</h2>
                  <p className="text-xs text-gray-500">Права доступа <span className="text-red-500">*</span></p>
                </div>
              </div>
              <div className="p-4">
                <RoleSelector
                  roles={allowedRoles}
                  selectedIds={formData.role_ids}
                  primaryId={formData.primary_role_id}
                  onChange={(ids, pid) => setFormData({ ...formData, role_ids: ids, primary_role_id: pid })}
                />
                {formData.role_ids.length === 0 && (
                  <p className="form-error text-center py-2 mt-1">Выберите хотя бы одну роль</p>
                )}
              </div>
            </div>

            {/* Итог */}
            {formData.role_ids.length > 0 && (
              <div className="card p-4" style={{ background: 'var(--cab-signal-weak)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--cab-signal)' }}>Итог</p>
                <div className="flex flex-wrap gap-1.5">
                  {allowedRoles.filter(r => formData.role_ids.includes(r.id)).map(role => (
                    <span key={role.id} className={getRoleBadgeClass(role.name)}>
                      {role.display_name}{formData.primary_role_id === role.id ? ' · осн.' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Мобильные кнопки */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl"
          >
            Отмена
          </button>
          <button
            onClick={() => createMutation.mutate(formData)}
            disabled={!isValid || createMutation.isPending}
            className="cab-btn cab-btn-primary flex-1 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Создание...</>
            ) : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
