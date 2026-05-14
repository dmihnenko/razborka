import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, User, Building2, Shield, ChevronRight,
  Plus, Check, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useIsAdmin, useUserProfile } from '@/hooks/useUserProfile'

interface Role {
  id: string
  name: string
  display_name: string
  description: string | null
  is_active: boolean
}

interface UserFormData {
  full_name: string
  phone: string
  role_ids: string[]
  primary_role_id: string
  sto_company_id: string
  parts_company_id: string
}

interface InlineForm {
  type: 'sto' | 'parts'
  name: string
  phone: string
  address: string
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

export default function UserEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = useIsAdmin()
  const { data: currentUserProfile } = useUserProfile()

  const isStoOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'sto_owner') || false
  const isPartsOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'parts_owner') || false

  const [formData, setFormData] = useState<UserFormData>({
    full_name: '', phone: '', role_ids: [],
    primary_role_id: '', sto_company_id: '', parts_company_id: '',
  })
  const [inlineForm, setInlineForm] = useState<InlineForm | null>(null)

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['user_profile', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from('user_profiles').select('*').eq('id', id!).single()
      if (error) throw error
      const { data: userRoles } = await supabase
        .from('user_roles').select('role_id, is_primary').eq('user_id', id!)
      return { ...profile, user_roles: userRoles || [] }
    }
  })

  useEffect(() => {
    if (userProfile) {
      const userRoles = userProfile.user_roles || []
      const primaryRole = userRoles.find((r: any) => r.is_primary)
      const roleIds = userRoles.map((r: any) => r.role_id)
      setFormData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
        role_ids: roleIds,
        primary_role_id: primaryRole?.role_id || roleIds[0] || '',
        sto_company_id: userProfile.sto_company_id || '',
        parts_company_id: userProfile.parts_company_id || '',
      })
    }
  }, [userProfile])

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('roles').select('*').eq('is_active', true)
      if (error) throw error
      return data as Role[]
    }
  })

  const { data: stoCompanies = [] } = useQuery({
    queryKey: ['sto_companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sto_companies').select('id, name').eq('is_active', true)
      if (error) throw error
      return data
    }
  })

  const { data: partsCompanies = [] } = useQuery({
    queryKey: ['parts_companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parts_companies').select('id, name').eq('is_active', true)
      if (error) throw error
      return data
    }
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

  const selectedRoleNames = useMemo(() =>
    allowedRoles.filter(r => formData.role_ids.includes(r.id)).map(r => r.name),
    [allowedRoles, formData.role_ids]
  )

  // Нужна ли компания для текущих ролей
  const stoRequired = selectedRoleNames.includes('sto_owner')
  const partsRequired = selectedRoleNames.includes('parts_owner')
  const stoMissing = stoRequired && !formData.sto_company_id
  const partsMissing = partsRequired && !formData.parts_company_id

  // Показывать кнопку создания компании
  const showCreateStoBtn = isAdmin && shouldShowStoCompany(selectedRoleNames) && stoRequired
  const showCreatePartsBtn = isAdmin && shouldShowPartsCompany(selectedRoleNames) && partsRequired

  // Мутация создания компании + привязка
  const createCompanyMutation = useMutation({
    mutationFn: async (form: InlineForm) => {
      const table = form.type === 'sto' ? 'sto_companies' : 'parts_companies'
      const profileField = form.type === 'sto' ? 'sto_company_id' : 'parts_company_id'

      const { data: company, error: createError } = await supabase
        .from(table)
        .insert({ name: form.name.trim(), phone: form.phone || null, address: form.address || null, is_active: true })
        .select('id, name').single()
      if (createError) throw createError

      const { error: assignError } = await supabase
        .from('user_profiles').update({ [profileField]: company.id }).eq('id', id!)
      if (assignError) throw assignError

      return { ...company, type: form.type }
    },
    onSuccess: ({ id: companyId, type }) => {
      if (type === 'sto') {
        setFormData(prev => ({ ...prev, sto_company_id: companyId }))
        queryClient.invalidateQueries({ queryKey: ['sto_companies'] })
      } else {
        setFormData(prev => ({ ...prev, parts_company_id: companyId }))
        queryClient.invalidateQueries({ queryKey: ['parts_companies'] })
      }
      queryClient.invalidateQueries({ queryKey: ['user_profile', id] })
      toast.success('Компания создана и привязана')
      setInlineForm(null)
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка при создании компании'),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ full_name: data.full_name, phone: data.phone, sto_company_id: data.sto_company_id || null, parts_company_id: data.parts_company_id || null })
        .eq('id', id!)
      if (profileError) throw profileError

      const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', id!)
      if (deleteError) throw deleteError

      if (data.role_ids.length > 0) {
        const { error: insertError } = await supabase.from('user_roles').upsert(
          data.role_ids.map(roleId => ({ user_id: id!, role_id: roleId, is_primary: roleId === data.primary_role_id })),
          { onConflict: 'user_id,role_id' }
        )
        if (insertError) throw insertError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user_profile'] })
      queryClient.invalidateQueries({ queryKey: ['user_profile', id] })
      toast.success('Данные пользователя обновлены')
      navigate(-1)
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка при обновлении'),
  })

  const toggleRole = (toggledId: string) => {
    const isSelected = formData.role_ids.includes(toggledId)
    if (isSelected) {
      const newIds = formData.role_ids.filter(rid => rid !== toggledId)
      setFormData({ ...formData, role_ids: newIds, primary_role_id: formData.primary_role_id === toggledId ? (newIds[0] || '') : formData.primary_role_id })
    } else {
      const newIds = [...formData.role_ids, toggledId]
      setFormData({ ...formData, role_ids: newIds, primary_role_id: formData.primary_role_id || toggledId })
    }
  }

  const isValid = formData.role_ids.length > 0 && !!formData.primary_role_id && !stoMissing && !partsMissing

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <span className="w-5 h-5 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin" />
          Загрузка...
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Пользователь не найден</p>
          <button onClick={() => navigate(-1)} className="text-purple-700 font-medium hover:underline">← Назад</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Хедер */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(-1)} className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                <span className="truncate">Пользователи</span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold text-gray-900 truncate">{userProfile.full_name || userProfile.username || userProfile.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors hidden sm:block">
                Отмена
              </button>
              <button
                onClick={() => updateMutation.mutate(formData)}
                disabled={!isValid || updateMutation.isPending}
                title={!isValid ? 'Заполните все обязательные поля' : ''}
                className="px-5 py-2 text-sm font-semibold text-white bg-purple-700 rounded-xl hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {updateMutation.isPending
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Сохранение...</>
                  : <><Check className="w-4 h-4" />Сохранить</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
        {/* Карточка пользователя */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {(userProfile.full_name || userProfile.username || userProfile.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{userProfile.full_name || 'Имя не указано'}</p>
            <p className="text-sm text-gray-500 truncate">{userProfile.email}</p>
            {userProfile.username && <p className="text-xs text-gray-400 font-mono mt-0.5">@{userProfile.username}</p>}
          </div>
          <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${userProfile.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {userProfile.is_active ? 'Активен' : 'Неактивен'}
          </span>
        </div>

        {/* Предупреждение о незаполненных обязательных полях */}
        {(stoMissing || partsMissing) && (
          <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Требуется привязка компании</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {stoMissing && 'Роль «Владелец СТО» требует привязанной компании. '}
                {partsMissing && 'Роль «Владелец Разборки» требует привязанной авторазборки.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка */}
          <div className="lg:col-span-2 space-y-4">
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
                  <input type="text" value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Иванов Иван Иванович" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Телефон</label>
                  <IMaskInput mask="+380 00 000-00-00" value={formData.phone}
                    onAccept={v => setFormData({ ...formData, phone: String(v) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="+380 XX XXX-XX-XX" />
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
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-gray-900">Привязка к компании</h2>
                    <p className="text-xs text-gray-500">Организация пользователя</p>
                  </div>
                  {(stoMissing || partsMissing) && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Требует настройки</span>
                  )}
                </div>
                <div className="p-5 space-y-5">
                  {/* СТО */}
                  {shouldShowStoCompany(selectedRoleNames) && (
                    <div>
                      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1.5">
                        СТО {stoRequired && <span className="text-red-500">*</span>}
                        {formData.sto_company_id && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-1" />}
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={formData.sto_company_id}
                          onChange={e => setFormData({ ...formData, sto_company_id: e.target.value })}
                          disabled={isStoOwner && !isAdmin}
                          className={`flex-1 px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white disabled:bg-gray-50 ${stoMissing ? 'border-amber-400 focus:ring-amber-400' : 'border-gray-300 focus:ring-purple-500'}`}
                        >
                          <option value="">Выберите СТО</option>
                          {stoCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {showCreateStoBtn && inlineForm?.type !== 'sto' && (
                          <button type="button"
                            onClick={() => setInlineForm({ type: 'sto', name: '', phone: '', address: '' })}
                            className="flex items-center gap-1.5 px-3 py-2.5 border border-dashed border-purple-400 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-50 transition-colors whitespace-nowrap">
                            <Plus className="w-4 h-4" />Создать
                          </button>
                        )}
                      </div>
                      {stoMissing && !inlineForm && (
                        <p className="flex items-center gap-1 text-xs text-amber-600 mt-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />Выберите или создайте СТО для этой роли
                        </p>
                      )}
                      {/* Inline форма создания СТО */}
                      {inlineForm?.type === 'sto' && (
                        <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Новое СТО</p>
                          <input autoFocus type="text" placeholder="Название *"
                            value={inlineForm.name}
                            onChange={e => setInlineForm({ ...inlineForm, name: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Escape') setInlineForm(null) }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Телефон"
                              value={inlineForm.phone}
                              onChange={e => setInlineForm({ ...inlineForm, phone: e.target.value })}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white" />
                            <input type="text" placeholder="Адрес"
                              value={inlineForm.address}
                              onChange={e => setInlineForm({ ...inlineForm, address: e.target.value })}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white" />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setInlineForm(null)}
                              className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                              Отмена
                            </button>
                            <button type="button"
                              disabled={!inlineForm.name.trim() || createCompanyMutation.isPending}
                              onClick={() => createCompanyMutation.mutate(inlineForm)}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-purple-700 rounded-lg hover:bg-purple-800 disabled:opacity-50 transition-colors">
                              {createCompanyMutation.isPending
                                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Создание...</>
                                : 'Создать и привязать'
                              }
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Авторазборка */}
                  {shouldShowPartsCompany(selectedRoleNames) && (
                    <div>
                      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1.5">
                        Авторазборка {partsRequired && <span className="text-red-500">*</span>}
                        {formData.parts_company_id && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-1" />}
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={formData.parts_company_id}
                          onChange={e => setFormData({ ...formData, parts_company_id: e.target.value })}
                          disabled={isPartsOwner && !isAdmin}
                          className={`flex-1 px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white disabled:bg-gray-50 ${partsMissing ? 'border-amber-400 focus:ring-amber-400' : 'border-gray-300 focus:ring-purple-500'}`}
                        >
                          <option value="">Выберите авторазборку</option>
                          {partsCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {showCreatePartsBtn && inlineForm?.type !== 'parts' && (
                          <button type="button"
                            onClick={() => setInlineForm({ type: 'parts', name: '', phone: '', address: '' })}
                            className="flex items-center gap-1.5 px-3 py-2.5 border border-dashed border-orange-400 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-50 transition-colors whitespace-nowrap">
                            <Plus className="w-4 h-4" />Создать
                          </button>
                        )}
                      </div>
                      {partsMissing && !inlineForm && (
                        <p className="flex items-center gap-1 text-xs text-amber-600 mt-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />Выберите или создайте авторазборку для этой роли
                        </p>
                      )}
                      {/* Inline форма создания Авторазборки */}
                      {inlineForm?.type === 'parts' && (
                        <div className="mt-3 p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3">
                          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Новая авторазборка</p>
                          <input autoFocus type="text" placeholder="Название *"
                            value={inlineForm.name}
                            onChange={e => setInlineForm({ ...inlineForm, name: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Escape') setInlineForm(null) }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Телефон"
                              value={inlineForm.phone}
                              onChange={e => setInlineForm({ ...inlineForm, phone: e.target.value })}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white" />
                            <input type="text" placeholder="Адрес"
                              value={inlineForm.address}
                              onChange={e => setInlineForm({ ...inlineForm, address: e.target.value })}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white" />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setInlineForm(null)}
                              className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                              Отмена
                            </button>
                            <button type="button"
                              disabled={!inlineForm.name.trim() || createCompanyMutation.isPending}
                              onClick={() => createCompanyMutation.mutate(inlineForm)}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors">
                              {createCompanyMutation.isPending
                                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Создание...</>
                                : 'Создать и привязать'
                              }
                            </button>
                          </div>
                        </div>
                      )}
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
                  const needsCompany = ['sto_owner', 'parts_owner'].includes(role.name)
                  const companyLinked = role.name === 'sto_owner' ? !!formData.sto_company_id : role.name === 'parts_owner' ? !!formData.parts_company_id : true
                  const showCompanyWarning = needsCompany && isSelected && !companyLinked

                  return (
                    <button key={role.id} type="button" role="checkbox" aria-checked={isSelected}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        isSelected
                          ? showCompanyWarning ? 'border-amber-300 bg-amber-50' : 'border-purple-300 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => toggleRole(role.id)}>
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
                            {isPrimary && isSelected && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-600 text-white">основная</span>}
                          </div>
                          {role.description && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{role.description}</p>}
                          {/* Статус компании под ролью владельца */}
                          {needsCompany && isSelected && (
                            <p className={`flex items-center gap-1 text-xs mt-1.5 ${companyLinked ? 'text-green-600' : 'text-amber-600'}`}>
                              {companyLinked
                                ? <><CheckCircle2 className="w-3 h-3" />Компания привязана</>
                                : <><AlertTriangle className="w-3 h-3" />Укажите компанию</>
                              }
                            </p>
                          )}
                          {isSelected && !isPrimary && (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); setFormData({ ...formData, primary_role_id: role.id }) }}
                              className="text-xs text-purple-600 font-medium mt-1.5 hover:underline">
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
          <button onClick={() => navigate(-1)} className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl">Отмена</button>
          <button
            onClick={() => updateMutation.mutate(formData)}
            disabled={!isValid || updateMutation.isPending}
            className="flex-1 py-3 text-sm font-semibold text-white bg-purple-700 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {updateMutation.isPending
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Сохранение...</>
              : 'Сохранить'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
