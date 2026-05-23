import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, User, Building2, Shield, ChevronRight,
  Plus, Check, AlertTriangle, CheckCircle2, ChevronDown, X
} from 'lucide-react'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import { getUserProfileWithRoles, getRoles, updateUserProfile, updateUserRoles, type Role } from '../services/userService'
import { getStoCompanies, getPartsCompanies, createCompanyAndAssign } from '../services/companyService'
import { useIsAdmin, useUserProfile } from '@/hooks/useUserProfile'
import { ROLE_COLORS, shouldShowStoCompany, shouldShowPartsCompany } from '@/utils/roles'

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

function RoleBadge({ name, display_name }: { name: string; display_name: string }) {
  const c = ROLE_COLORS[name] || ROLE_COLORS.user
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {display_name}
    </span>
  )
}


export default function UserEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = useIsAdmin()
  const { data: currentUserProfile } = useUserProfile()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [rolesOpen, setRolesOpen] = useState(false)

  const isStoOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'sto_owner') || false
  const isPartsOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'parts_owner') || false

  const [formData, setFormData] = useState<UserFormData>({
    full_name: '', phone: '', role_ids: [],
    primary_role_id: '', sto_company_id: '', parts_company_id: '',
  })
  const [inlineForm, setInlineForm] = useState<InlineForm | null>(null)

  // Закрыть dropdown при клике снаружи
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRolesOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['user_profile', id],
    enabled: !!id,
    queryFn: () => getUserProfileWithRoles(id!)
  })

  useEffect(() => {
    if (userProfile) {
      const userRoles = userProfile.user_roles || []
      const primaryRole = userRoles.find((r: any) => r.is_primary)
      const roleIds = userRoles.map((r: any) => r.role_id)
      setFormData({
        full_name: userProfile?.full_name || '',
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
    queryFn: () => getRoles()
  })
  const { data: stoCompanies = [] } = useQuery({
    queryKey: ['sto_companies'],
    queryFn: () => getStoCompanies()
  })
  const { data: partsCompanies = [] } = useQuery({
    queryKey: ['parts_companies'],
    queryFn: () => getPartsCompanies()
  })

  const allowedRoles = useMemo(() => roles.filter(role => {
    if (role.name === 'user') return false
    if (isAdmin) return true
    if (isStoOwner) return role.name === 'sto_worker'
    if (isPartsOwner) return role.name === 'parts_worker'
    return false
  }), [roles, isAdmin, isStoOwner, isPartsOwner])

  const selectedRoles = useMemo(() => allowedRoles.filter(r => formData.role_ids.includes(r.id)), [allowedRoles, formData.role_ids])
  const selectedRoleNames = useMemo(() => selectedRoles.map(r => r.name), [selectedRoles])

  const stoRequired = selectedRoleNames.includes('sto_owner')
  const partsRequired = selectedRoleNames.includes('parts_owner')
  const stoMissing = stoRequired && !formData.sto_company_id
  const partsMissing = partsRequired && !formData.parts_company_id

  const toggleRole = (roleId: string) => {
    const isSelected = formData.role_ids.includes(roleId)
    if (isSelected) {
      const newIds = formData.role_ids.filter(rid => rid !== roleId)
      setFormData(prev => ({ ...prev, role_ids: newIds, primary_role_id: prev.primary_role_id === roleId ? (newIds[0] || '') : prev.primary_role_id }))
    } else {
      const newIds = [...formData.role_ids, roleId]
      setFormData(prev => ({ ...prev, role_ids: newIds, primary_role_id: prev.primary_role_id || roleId }))
    }
  }

  const createCompanyMutation = useMutation({
    mutationFn: (form: InlineForm) => createCompanyAndAssign({
      type: form.type,
      name: form.name,
      phone: form.phone,
      address: form.address,
      userId: id!,
    }),
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
      await updateUserProfile({
        userId: id!,
        full_name: data.full_name,
        phone: data.phone,
        sto_company_id: data.sto_company_id || null,
        parts_company_id: data.parts_company_id || null,
      })
      await updateUserRoles({
        userId: id!,
        role_ids: data.role_ids,
        primary_role_id: data.primary_role_id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user_profile'] })
      queryClient.invalidateQueries({ queryKey: ['user_profile', id] })
      toast.success('Данные сохранены')
      navigate(-1)
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка при сохранении'),
  })

  const isValid = formData.role_ids.length > 0 && !!formData.primary_role_id && !stoMissing && !partsMissing

  if (profileLoading) {
    return (
      <div className="min-h-dvh bg-[#F4F6FA] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">Загрузка...</span>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="min-h-dvh bg-[#F4F6FA] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Пользователь не найден</p>
          <button onClick={() => navigate(-1)} className="text-indigo-600 font-medium hover:underline text-sm">← Назад</button>
        </div>
      </div>
    )
  }

  const avatarLetter = (userProfile?.full_name || userProfile?.username || userProfile?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-dvh bg-[#F4F6FA]">
      {/* Хедер */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200/80 shadow-sm">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700 flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-gray-400 hidden sm:block">Пользователи</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 hidden sm:block" />
              <span className="font-semibold text-gray-800 truncate">{userProfile?.full_name || userProfile?.username || userProfile?.email}</span>
              <span className="hidden sm:inline text-gray-300">·</span>
              <span className="hidden sm:inline text-xs text-gray-400">edit</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigate(-1)} className="hidden sm:flex px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Отмена
            </button>
            <button
              onClick={() => updateMutation.mutate(formData)}
              disabled={!isValid || updateMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {updateMutation.isPending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Check className="w-4 h-4" />
              }
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-6">

        {/* Карточка пользователя */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5 overflow-hidden">
          {/* Градиентная шапка */}
          <div className="relative h-20 sm:h-24 bg-gradient-to-br from-violet-600 via-indigo-500 to-blue-400 overflow-hidden">
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -bottom-6 -left-2 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute top-2 right-16 w-10 h-10 rounded-full bg-white/10" />
          </div>
          <div className="px-5 pb-5">
            <div className="flex items-end justify-between -mt-9 mb-4">
              <div className="relative">
                <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-extrabold ring-[3px] ring-white shadow-xl">
                  {avatarLetter}
                </div>
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${userProfile?.is_active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
              </div>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full tracking-wide ${userProfile?.is_active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                {userProfile?.is_active ? '● Активен' : '○ Неактивен'}
              </span>
            </div>
            <div className="space-y-0.5">
              <p className="text-lg font-bold text-gray-900 leading-snug">
                {userProfile?.full_name || <span className="text-gray-400 font-normal">Имя не указано</span>}
              </p>
              {userProfile?.email && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                  {userProfile.email}
                </p>
              )}
              {userProfile?.username && (
                <p className="text-xs text-indigo-400 font-mono font-semibold tracking-tight">@{userProfile.username}</p>
              )}
            </div>
          </div>
        </div>

        {/* Предупреждение */}
        {(stoMissing || partsMissing) && (
          <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Требуется привязка компании</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {stoMissing && 'Роль «Владелец СТО» требует привязанной компании. '}
                {partsMissing && 'Роль «Владелец Разборки» требует авторазборки.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Левая колонка */}
          <div className="lg:col-span-2 space-y-4">

            {/* Профиль */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Профиль</p>
                  <p className="text-xs text-gray-400">Контактные данные</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">ФИО</label>
                  <input type="text" value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    placeholder="Иванов Иван Иванович" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Телефон</label>
                  <IMaskInput mask="+380 00 000-00-00" value={formData.phone}
                    onAccept={v => setFormData({ ...formData, phone: String(v) })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    placeholder="+380 XX XXX-XX-XX" />
                </div>
              </div>
            </div>

            {/* Роли — ВЫПАДАЮЩЕЕ МЕНЮ */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative z-10">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Роли <span className="text-red-400">*</span></p>
                  <p className="text-xs text-gray-400">Права доступа пользователя</p>
                </div>
              </div>
              <div className="p-5 overflow-visible">
                {/* Выбранные роли — теги */}
                <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
                  {selectedRoles.length === 0
                    ? <span className="text-xs text-gray-400">Роли не выбраны</span>
                    : selectedRoles.map(role => (
                      <span key={role.id} className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-semibold ${ROLE_COLORS[role.name]?.bg || 'bg-gray-100'} ${ROLE_COLORS[role.name]?.text || 'text-gray-600'}`}>
                        {role.display_name}
                        {formData.primary_role_id === role.id && (
                          <span className="bg-white/70 px-1.5 py-0.5 rounded text-[10px] font-bold">осн.</span>
                        )}
                        <button type="button" onClick={() => toggleRole(role.id)}
                          className="ml-0.5 p-0.5 rounded hover:bg-black/10 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  }
                </div>

                {/* Дропдаун */}
                <div className="relative" ref={dropdownRef}>
                  <button type="button" onClick={() => setRolesOpen(!rolesOpen)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-white hover:border-indigo-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all">
                    <span className="truncate">{selectedRoles.length === 0 ? 'Выберите роль...' : 'Добавить ещё роль'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${rolesOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {rolesOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto" style={{ zIndex: 9999 }}>
                      {allowedRoles.map(role => {
                        const isSelected = formData.role_ids.includes(role.id)
                        return (
                          <button key={role.id} type="button"
                            onClick={() => { toggleRole(role.id); if (!isSelected) setRolesOpen(false) }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${isSelected ? 'bg-indigo-50' : ''}`}>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                              {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <RoleBadge name={role.name} display_name={role.display_name} />
                              </div>
                              {role.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{role.description}</p>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Выбор основной роли */}
                {selectedRoles.length > 1 && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Основная роль</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoles.map(role => (
                        <button key={role.id} type="button"
                          onClick={() => setFormData({ ...formData, primary_role_id: role.id })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            formData.primary_role_id === role.id
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                          }`}>
                          {formData.primary_role_id === role.id && <Check className="w-3 h-3" />}
                          {role.display_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Мобильная мини-сводка ролей — только мобиле */}
            {selectedRoles.length > 0 && (
              <div className="lg:hidden flex flex-wrap items-center gap-2 px-4 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mr-1">Роли:</span>
                {selectedRoles.map(role => (
                  <span key={role.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${ROLE_COLORS[role.name]?.bg || 'bg-gray-100'} ${ROLE_COLORS[role.name]?.text || 'text-gray-600'}`}>
                    {role.display_name}
                    {formData.primary_role_id === role.id && <span className="opacity-60 text-[10px]">·осн</span>}
                  </span>
                ))}
              </div>
            )}

            {/* Привязка к компании */}
            {(shouldShowStoCompany(selectedRoleNames) || shouldShowPartsCompany(selectedRoleNames)) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">Привязка к компании</p>
                    <p className="text-xs text-gray-400">Организация пользователя</p>
                  </div>
                  {(stoMissing || partsMissing) && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 mr-2">Требует настройки</span>
                  )}
                  {isAdmin && selectedRoleNames.includes('sto_owner') && inlineForm?.type !== 'sto' && (
                    <button type="button"
                      onClick={() => setInlineForm({ type: 'sto', name: '', phone: '', address: '' })}
                      className="flex items-center gap-1 px-2.5 py-1 border border-dashed border-indigo-300 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-50 transition-colors whitespace-nowrap">
                      <Plus className="w-3.5 h-3.5" />+ СТО
                    </button>
                  )}
                  {isAdmin && selectedRoleNames.includes('parts_owner') && inlineForm?.type !== 'parts' && (
                    <button type="button"
                      onClick={() => setInlineForm({ type: 'parts', name: '', phone: '', address: '' })}
                      className="flex items-center gap-1 px-2.5 py-1 border border-dashed border-orange-300 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-50 transition-colors whitespace-nowrap">
                      <Plus className="w-3.5 h-3.5" />+ Разборку
                    </button>
                  )}
                </div>
                <div className="p-5 space-y-5">

                  {/* СТО */}
                  {shouldShowStoCompany(selectedRoleNames) && (
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        СТО {stoRequired && <span className="text-red-400">*</span>}
                        {formData.sto_company_id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </label>
                      <div className="flex gap-2">
                        <select value={formData.sto_company_id}
                          onChange={e => setFormData({ ...formData, sto_company_id: e.target.value })}
                          disabled={isStoOwner && !isAdmin}
                          className={`flex-1 px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 transition-all disabled:opacity-60 ${stoMissing ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-100' : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-100'}`}>
                          <option value="">Выберите СТО</option>
                          {stoCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      {stoMissing && !inlineForm && (
                        <p className="flex items-center gap-1 text-xs text-amber-600 mt-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />Выберите или создайте СТО
                        </p>
                      )}
                      {inlineForm?.type === 'sto' && (
                        <div className="mt-3 p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
                          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Новое СТО</p>
                          <input autoFocus type="text" placeholder="Название *" value={inlineForm.name}
                            onChange={e => setInlineForm({ ...inlineForm, name: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Escape') setInlineForm(null) }}
                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Телефон" value={inlineForm.phone}
                              onChange={e => setInlineForm({ ...inlineForm, phone: e.target.value })}
                              className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
                            <input type="text" placeholder="Адрес" value={inlineForm.address}
                              onChange={e => setInlineForm({ ...inlineForm, address: e.target.value })}
                              className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setInlineForm(null)}
                              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Отмена</button>
                            <button type="button"
                              disabled={!inlineForm.name.trim() || createCompanyMutation.isPending}
                              onClick={() => createCompanyMutation.mutate(inlineForm)}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                              {createCompanyMutation.isPending
                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Check className="w-4 h-4" />}
                              Создать и привязать
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Авторазборка */}
                  {shouldShowPartsCompany(selectedRoleNames) && (
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Авторазборка {partsRequired && <span className="text-red-400">*</span>}
                        {formData.parts_company_id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </label>
                      <div className="flex gap-2">
                        <select value={formData.parts_company_id}
                          onChange={e => setFormData({ ...formData, parts_company_id: e.target.value })}
                          disabled={isPartsOwner && !isAdmin}
                          className={`flex-1 px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 transition-all disabled:opacity-60 ${partsMissing ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-100' : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-100'}`}>
                          <option value="">Выберите авторазборку</option>
                          {partsCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      {partsMissing && !inlineForm && (
                        <p className="flex items-center gap-1 text-xs text-amber-600 mt-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />Выберите или создайте авторазборку
                        </p>
                      )}
                      {inlineForm?.type === 'parts' && (
                        <div className="mt-3 p-4 bg-orange-50/60 border border-orange-200 rounded-xl space-y-3">
                          <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Новая авторазборка</p>
                          <input autoFocus type="text" placeholder="Название *" value={inlineForm.name}
                            onChange={e => setInlineForm({ ...inlineForm, name: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Escape') setInlineForm(null) }}
                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Телефон" value={inlineForm.phone}
                              onChange={e => setInlineForm({ ...inlineForm, phone: e.target.value })}
                              className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
                            <input type="text" placeholder="Адрес" value={inlineForm.address}
                              onChange={e => setInlineForm({ ...inlineForm, address: e.target.value })}
                              className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setInlineForm(null)}
                              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Отмена</button>
                            <button type="button"
                              disabled={!inlineForm.name.trim() || createCompanyMutation.isPending}
                              onClick={() => createCompanyMutation.mutate(inlineForm)}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors">
                              {createCompanyMutation.isPending
                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Check className="w-4 h-4" />}
                              Создать и привязать
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

          {/* Правая колонка — сводка (только десктоп) */}
          <div className="hidden lg:block space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:sticky lg:top-20">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">Сводка</p>
                <p className="text-xs text-gray-400">Текущее состояние</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Роли */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Роли</p>
                  {selectedRoles.length === 0
                    ? <p className="text-xs text-red-500">Не выбрана ни одна роль</p>
                    : <div className="space-y-1.5">
                        {selectedRoles.map(role => (
                          <div key={role.id} className="flex items-center justify-between">
                            <RoleBadge name={role.name} display_name={role.display_name} />
                            {formData.primary_role_id === role.id && (
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">основная</span>
                            )}
                          </div>
                        ))}
                      </div>
                  }
                </div>

                {/* Компании */}
                {(shouldShowStoCompany(selectedRoleNames) || shouldShowPartsCompany(selectedRoleNames)) && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Компании</p>
                    <div className="space-y-1.5">
                      {shouldShowStoCompany(selectedRoleNames) && (
                        <div className="flex items-center gap-2 text-xs">
                          {formData.sto_company_id
                            ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /><span className="text-gray-700">{stoCompanies.find((c: any) => c.id === formData.sto_company_id)?.name || '—'}</span></>
                            : <><AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /><span className="text-amber-600">СТО не выбрано</span></>
                          }
                        </div>
                      )}
                      {shouldShowPartsCompany(selectedRoleNames) && (
                        <div className="flex items-center gap-2 text-xs">
                          {formData.parts_company_id
                            ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /><span className="text-gray-700">{partsCompanies.find((c: any) => c.id === formData.parts_company_id)?.name || '—'}</span></>
                            : <><AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /><span className="text-amber-600">Авторазборка не выбрана</span></>
                          }
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Кнопка сохранить в сводке (десктоп) */}
                <div className="border-t border-gray-100 pt-4">
                  <button
                    onClick={() => updateMutation.mutate(formData)}
                    disabled={!isValid || updateMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                    {updateMutation.isPending
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Check className="w-4 h-4" />}
                    {updateMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                  {!isValid && (
                    <p className="text-xs text-gray-400 text-center mt-2">Заполните все обязательные поля</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Мобильные кнопки */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex gap-3 z-40">
          <button onClick={() => navigate(-1)} className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl">Отмена</button>
          <button onClick={() => updateMutation.mutate(formData)} disabled={!isValid || updateMutation.isPending}
            className="flex-1 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {updateMutation.isPending
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Check className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
