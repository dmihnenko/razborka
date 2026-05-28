import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, User, Lock, Building2, Shield, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getRoles } from '../services/userService'
import { getStoCompanies, getPartsCompanies } from '../services/companyService'
import { useIsAdmin, useUserProfile } from '@/hooks/useUserProfile'

interface UserFormData {
  email: string
  username: string
  password: string
  full_name: string
  phone: string
  role_ids: string[]
  primary_role_id: string
  sto_company_id: string
  parts_company_id: string
}

function getRoleBadgeColor(roleName?: string) {
  const colors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 border-red-200',
    sto_owner: 'bg-blue-100 text-blue-700 border-blue-200',
    sto_worker: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    parts_owner: 'bg-orange-100 text-orange-700 border-orange-200',
    parts_worker: 'bg-amber-100 text-amber-700 border-amber-200',
    user: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return colors[roleName || ''] || 'bg-gray-100 text-gray-600 border-gray-200'
}

function shouldShowStoCompany(roleNames: string[]) {
  return roleNames.some(n => ['admin', 'sto_owner', 'sto_worker'].includes(n))
}

function shouldShowPartsCompany(roleNames: string[]) {
  return roleNames.some(n => ['admin', 'parts_owner', 'parts_worker'].includes(n))
}

export default function UserCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = useIsAdmin()
  const { data: currentUserProfile } = useUserProfile()

  const isStoOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'sto_owner') || false
  const isPartsOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'parts_owner') || false

  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    username: '',
    password: '',
    full_name: '',
    phone: '',
    role_ids: [],
    primary_role_id: '',
    sto_company_id: '',
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
      if (isStoOwner && !isAdmin && currentUserProfile.sto_company_id) {
        updates.sto_company_id = currentUserProfile.sto_company_id
      }
      if (isPartsOwner && !isAdmin && currentUserProfile.parts_company_id) {
        updates.parts_company_id = currentUserProfile.parts_company_id
      }

      // Автоподставляем роль работника если она ещё не выбрана
      if (prev.role_ids.length === 0) {
        const workerRole = roles.find(r =>
          (isStoOwner && r.name === 'sto_worker') ||
          (isPartsOwner && r.name === 'parts_worker')
        )
        if (workerRole) {
          updates.role_ids = [workerRole.id]
          updates.primary_role_id = workerRole.id
        }
      }

      return { ...prev, ...updates }
    })
  }, [currentUserProfile, roles, isStoOwner, isPartsOwner, isAdmin])
  const [showPassword, setShowPassword] = useState(false)

  const { data: stoCompanies = [] } = useQuery({
    queryKey: ['sto_companies'],
    queryFn: () => getStoCompanies()
  })

  const { data: partsCompanies = [] } = useQuery({
    queryKey: ['parts_companies'],
    queryFn: () => getPartsCompanies()
  })

  const allowedRoles = useMemo(() => {
    return roles.filter((role) => {
      if (role.name === 'user') return false
      if (isAdmin) return true
      if (isStoOwner) return role.name === 'sto_worker'
      if (isPartsOwner) return role.name === 'parts_worker'
      return false
    })
  }, [roles, isAdmin, isStoOwner, isPartsOwner])

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
          sto_company_id: data.sto_company_id || null,
          parts_company_id: data.parts_company_id || null,
        }
      })
      if (fnError) throw new Error(fnError.message)
      if (fnData?.error) throw new Error(fnData.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      toast.success('Пользователь создан')
      navigate(-1) // возвращаемся туда откуда пришли (users или admin/users)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при создании пользователя')
    }
  })

  const toggleRole = (roleId: string) => {
    const isSelected = formData.role_ids.includes(roleId)
    if (isSelected) {
      const newIds = formData.role_ids.filter(id => id !== roleId)
      setFormData({
        ...formData,
        role_ids: newIds,
        primary_role_id: formData.primary_role_id === roleId ? (newIds[0] || '') : formData.primary_role_id
      })
    } else {
      const newIds = [...formData.role_ids, roleId]
      setFormData({
        ...formData,
        role_ids: newIds,
        primary_role_id: formData.primary_role_id || roleId
      })
    }
  }

  const needsStoCompany = selectedRoleNames.some(n => ['sto_owner', 'sto_worker'].includes(n))
  const needsPartsCompany = selectedRoleNames.some(n => ['parts_owner', 'parts_worker'].includes(n))
  const isValid = formData.username.trim().length >= 2
    && formData.password.length >= 6
    && formData.role_ids.length > 0
    && !!formData.primary_role_id
    && (!needsStoCompany || !!formData.sto_company_id)
    && (!needsPartsCompany || !!formData.parts_company_id)

  return (
    <div className="min-h-dvh bg-gray-50">
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
                className="px-5 py-2 text-sm font-semibold text-white bg-purple-700 rounded-xl hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-purple-700" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Доступ в систему</h2>
                  <p className="text-xs text-gray-500">Логин и пароль для входа</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Логин <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="username"
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-400 mt-1">Основной идентификатор для входа</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Пароль <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Минимум 6 символов"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {formData.password.length > 0 && formData.password.length < 6 && (
                      <p className="text-xs text-red-500 mt-1">Минимум 6 символов</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="user@example.com"
                      autoComplete="off"
                    />
                    <p className="text-xs text-gray-400 mt-1">Опционально, для восстановления</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Профиль */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-700" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Профиль</h2>
                  <p className="text-xs text-gray-500">Контактные данные</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ФИО</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Телефон</label>
                  <IMaskInput
                    mask="+380 00 000-00-00"
                    value={formData.phone}
                    onAccept={v => setFormData({ ...formData, phone: String(v) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="+380 XX XXX-XX-XX"
                  />
                </div>
              </div>
            </div>

            {/* Привязка к компании */}
            {(shouldShowStoCompany(selectedRoleNames) || shouldShowPartsCompany(selectedRoleNames)) && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Привязка к компании</h2>
                    <p className="text-xs text-gray-500">Организация пользователя</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {shouldShowStoCompany(selectedRoleNames) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        СТО {selectedRoleNames.some(n => ['sto_owner','sto_worker'].includes(n)) ? <span className="text-red-500">*</span> : ''}
                      </label>
                      <select
                        value={formData.sto_company_id}
                        onChange={e => setFormData({ ...formData, sto_company_id: e.target.value })}
                        disabled={isStoOwner && !isAdmin}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white disabled:bg-gray-50"
                      >
                        <option value="">Выберите СТО</option>
                        {stoCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  {shouldShowPartsCompany(selectedRoleNames) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Авторазборка {selectedRoleNames.some(n => ['parts_owner','parts_worker'].includes(n)) ? <span className="text-red-500">*</span> : ''}
                      </label>
                      <select
                        value={formData.parts_company_id}
                        onChange={e => setFormData({ ...formData, parts_company_id: e.target.value })}
                        disabled={isPartsOwner && !isAdmin}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white disabled:bg-gray-50"
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
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden lg:sticky lg:top-24">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-purple-700" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Роли</h2>
                  <p className="text-xs text-gray-500">Права доступа <span className="text-red-500">*</span></p>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {allowedRoles.map(role => {
                  const isSelected = formData.role_ids.includes(role.id)
                  const isPrimary = formData.primary_role_id === role.id
                  return (
                    <button
                      key={role.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
                        isSelected ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => toggleRole(role.id)}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 bg-white'
                        }`}>
                          {isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeColor(role.name)}`}>
                              {role.display_name}
                            </span>
                            {isPrimary && isSelected && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-600 text-white">основная</span>
                            )}
                          </div>
                          {role.description && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{role.description}</p>}
                          {isSelected && !isPrimary && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setFormData({ ...formData, primary_role_id: role.id }) }}
                              className="text-xs text-purple-600 font-medium mt-1.5 hover:underline"
                            >
                              Сделать основной
                            </button>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
                {formData.role_ids.length === 0 && (
                  <p className="text-xs text-red-500 text-center py-2">Выберите хотя бы одну роль</p>
                )}
              </div>
            </div>

            {/* Итог */}
            {formData.role_ids.length > 0 && (
              <div className="bg-purple-50 rounded-2xl border border-purple-200 p-4">
                <p className="text-xs font-semibold text-purple-700 mb-2">Итог</p>
                <div className="flex flex-wrap gap-1.5">
                  {allowedRoles.filter(r => formData.role_ids.includes(r.id)).map(role => (
                    <span key={role.id} className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeColor(role.name)}`}>
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
            className="flex-1 py-3 text-sm font-semibold text-white bg-purple-700 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
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
