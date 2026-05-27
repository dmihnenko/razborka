import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, User, Building2, Shield, ChevronRight, Check, Plus, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useIsAdmin, useUserProfile } from '@/hooks/useUserProfile'
import { ROLE_COLORS, shouldShowStoCompany, shouldShowPartsCompany } from '@/utils/roles'
import { updateUserProfile, updateUserRoles } from '@/services/userService'
import { getStoCompanies, getPartsCompanies } from '@/services/companyService'

interface Role { id: string; name: string; display_name: string; description: string | null; is_active: boolean }
interface InlineForm { type: 'sto' | 'parts'; name: string; phone: string; address: string }

type Step = 1 | 2 | 3

const STEPS = [
  { num: 1, label: 'Профиль' },
  { num: 2, label: 'Роль' },
  { num: 3, label: 'Компания' },
]

export default function UserEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = useIsAdmin()
  const { data: currentUserProfile } = useUserProfile()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isStoOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'sto_owner') || false
  const isPartsOwner = currentUserProfile?.roles?.some((r: any) => r.name === 'parts_owner') || false

  const [step, setStep] = useState<Step>(1)
  const [rolesOpen, setRolesOpen] = useState(false)
  const [inlineForm, setInlineForm] = useState<InlineForm | null>(null)

  const [formData, setFormData] = useState({
    full_name: '', phone: '', username: '',
    role_ids: [] as string[], primary_role_id: '',
    sto_company_id: '', parts_company_id: '',
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setRolesOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['user_profile', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: profile, error } = await supabase.from('user_profiles').select('*').eq('id', id!).single()
      if (error) throw error
      const { data: userRoles } = await supabase.from('user_roles').select('role_id, is_primary').eq('user_id', id!)
      return { ...profile, user_roles: userRoles || [] }
    }
  })

  useEffect(() => {
    if (userProfile) {
      const userRoles = userProfile.user_roles || []
      const primary = userRoles.find((r: any) => r.is_primary)
      const roleIds = userRoles.map((r: any) => r.role_id)
      setFormData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
        username: userProfile.username || '',
        role_ids: roleIds,
        primary_role_id: primary?.role_id || roleIds[0] || '',
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
  const { data: stoCompanies = [] } = useQuery({ queryKey: ['sto_companies'], queryFn: getStoCompanies })
  const { data: partsCompanies = [] } = useQuery({ queryKey: ['parts_companies'], queryFn: getPartsCompanies })

  const allowedRoles = useMemo(() => roles.filter(role => {
    if (role.name === 'user') return false
    if (isAdmin) return true
    if (isStoOwner) return role.name === 'sto_worker'
    if (isPartsOwner) return role.name === 'parts_worker'
    return false
  }), [roles, isAdmin, isStoOwner, isPartsOwner])

  const selectedRoles = useMemo(() => allowedRoles.filter(r => formData.role_ids.includes(r.id)), [allowedRoles, formData.role_ids])
  const selectedRoleNames = useMemo(() => selectedRoles.map(r => r.name), [selectedRoles])

  const needsSto = selectedRoleNames.includes('sto_owner')
  const needsParts = selectedRoleNames.includes('parts_owner')
  const stoMissing = needsSto && !formData.sto_company_id
  const partsMissing = needsParts && !formData.parts_company_id
  const hasCompanyStep = shouldShowStoCompany(selectedRoleNames) || shouldShowPartsCompany(selectedRoleNames)

  const totalSteps: Step = hasCompanyStep ? 3 : 2

  const createCompanyMutation = useMutation({
    mutationFn: async (form: InlineForm) => {
      const table = form.type === 'sto' ? 'sto_companies' : 'parts_companies'
      const field = form.type === 'sto' ? 'sto_company_id' : 'parts_company_id'
      const { data: company, error } = await supabase.from(table)
        .insert({ name: form.name.trim(), phone: form.phone || null, address: form.address || null, is_active: true })
        .select('id').single()
      if (error) throw error
      await supabase.from('user_profiles').update({ [field]: company.id }).eq('id', id!)
      return { id: company.id, type: form.type }
    },
    onSuccess: ({ id: cid, type }) => {
      if (type === 'sto') { setFormData(p => ({ ...p, sto_company_id: cid })); queryClient.invalidateQueries({ queryKey: ['sto_companies'] }) }
      else { setFormData(p => ({ ...p, parts_company_id: cid })); queryClient.invalidateQueries({ queryKey: ['parts_companies'] }) }
      queryClient.invalidateQueries({ queryKey: ['user_profile', id] })
      toast.success('Компания создана и привязана')
      setInlineForm(null)
    },
    onError: (e: any) => toast.error(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (isAdmin && formData.username && formData.username !== userProfile?.username) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-username`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
            body: JSON.stringify({ targetUserId: id, newUsername: formData.username }),
          })
          const result = await res.json()
          if (!res.ok || result.error) throw new Error(result.error || 'Ошибка смены логина')
        }
      }
      await updateUserProfile({ userId: id!, full_name: formData.full_name, phone: formData.phone, sto_company_id: formData.sto_company_id || null, parts_company_id: formData.parts_company_id || null })
      await updateUserRoles({ userId: id!, role_ids: formData.role_ids, primary_role_id: formData.primary_role_id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user_profile'] })
      toast.success('Сохранено')
      navigate(-1)
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })

  const toggleRole = (roleId: string) => {
    const isSelected = formData.role_ids.includes(roleId)
    if (isSelected) {
      const newIds = formData.role_ids.filter(rid => rid !== roleId)
      setFormData(p => ({ ...p, role_ids: newIds, primary_role_id: p.primary_role_id === roleId ? (newIds[0] || '') : p.primary_role_id }))
    } else {
      const newIds = [...formData.role_ids, roleId]
      setFormData(p => ({ ...p, role_ids: newIds, primary_role_id: p.primary_role_id || roleId }))
    }
    setRolesOpen(false)
  }

  const canGoNext = step === 1 ? true : step === 2 ? formData.role_ids.length > 0 : true
  const canSave = formData.role_ids.length > 0 && !stoMissing && !partsMissing

  const handleNext = () => {
    if (step < totalSteps) setStep((step + 1) as Step)
    else updateMutation.mutate()
  }
  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step)
    else navigate(-1)
  }

  if (isLoading) return (
    <div className="min-h-dvh bg-[#F4F6FA] flex items-center justify-center">
      <span className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  )

  if (!userProfile) return (
    <div className="min-h-dvh bg-[#F4F6FA] flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Пользователь не найден</p>
        <button onClick={() => navigate(-1)} className="text-indigo-600 hover:underline text-sm">← Назад</button>
      </div>
    </div>
  )

  const avatarLetter = (userProfile.full_name || userProfile.username || userProfile.email || '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-dvh bg-[#F4F6FA] flex flex-col">
      {/* Хедер */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200/80 shadow-sm">
        <div className="px-4 h-14 flex items-center gap-3">
          <button onClick={handleBack} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{userProfile.full_name || userProfile.username || userProfile.email}</p>
            <p className="text-[11px] text-gray-400">Шаг {step} из {totalSteps}</p>
          </div>
          {step === totalSteps ? (
            <button onClick={() => updateMutation.mutate()} disabled={!canSave || updateMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              {updateMutation.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2} />}
              Сохранить
            </button>
          ) : (
            <button onClick={handleNext} disabled={!canGoNext}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              Далее <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Прогресс */}
        <div className="px-4 pb-3 flex items-center gap-2">
          {STEPS.slice(0, totalSteps).map((s, i) => (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                step > s.num ? 'bg-indigo-600 text-white' : step === s.num ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {step > s.num ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : s.num}
              </div>
              <span className={`text-xs font-medium ${step === s.num ? 'text-indigo-700' : 'text-gray-400'}`}>{s.label}</span>
              {i < totalSteps - 1 && <div className={`flex-1 h-0.5 rounded-full ${step > s.num ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] max-w-lg mx-auto w-full">

        {/* Карточка пользователя */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-sm">
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{userProfile.full_name || 'Имя не указано'}</p>
            <p className="text-xs text-gray-400 truncate">{userProfile.email}</p>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${userProfile.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
            {userProfile.is_active ? 'Активен' : 'Неактивен'}
          </span>
        </div>

        {/* ─── ШАГ 1: Профиль ─── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Профиль</p>
                <p className="text-xs text-gray-400">Личные данные</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">ФИО</label>
                <input type="text" value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Иванов Иван Иванович"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Логин (username)</label>
                  <input type="text" value={formData.username}
                    onChange={e => setFormData(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    placeholder="username" autoComplete="off"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
                  <p className="text-xs text-gray-400 mt-1">Только латиница, цифры, _ (3-30 символов)</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Телефон</label>
                <IMaskInput mask="+380 00 000-00-00" value={formData.phone}
                  onAccept={v => setFormData(p => ({ ...p, phone: String(v) }))}
                  placeholder="+380 XX XXX-XX-XX"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
              </div>
            </div>
          </div>
        )}

        {/* ─── ШАГ 2: Роли ─── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-purple-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Роль <span className="text-red-400">*</span></p>
                <p className="text-xs text-gray-400">Права доступа</p>
              </div>
            </div>
            <div className="p-5">
              {/* Выбранные теги */}
              {selectedRoles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedRoles.map(role => {
                    const c = ROLE_COLORS[role.name] || ROLE_COLORS.user
                    return (
                      <span key={role.id} className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl text-sm font-semibold ${c.bg} ${c.text}`}>
                        {role.display_name}
                        {formData.primary_role_id === role.id && <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded font-bold">осн.</span>}
                        <button type="button" onClick={() => toggleRole(role.id)} className="p-0.5 rounded hover:bg-black/10">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Дропдаун */}
              <div className="relative" ref={dropdownRef}>
                <button type="button" onClick={() => setRolesOpen(!rolesOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-white hover:border-indigo-300 transition-all min-h-[44px]">
                  <span>{selectedRoles.length === 0 ? 'Выберите роль...' : 'Добавить ещё'}</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${rolesOpen ? 'rotate-90' : ''}`} strokeWidth={1.5} />
                </button>
                {rolesOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden" style={{ zIndex: 9999 }}>
                    {allowedRoles.map(role => {
                      const c = ROLE_COLORS[role.name] || ROLE_COLORS.user
                      const isSelected = formData.role_ids.includes(role.id)
                      return (
                        <button key={role.id} type="button" onClick={() => toggleRole(role.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-gray-100 last:border-0 ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                            <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-800">{role.display_name}</p>
                            {role.description && <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" strokeWidth={2.5} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Выбор основной */}
              {selectedRoles.length > 1 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Основная роль</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoles.map(role => (
                      <button key={role.id} type="button" onClick={() => setFormData(p => ({ ...p, primary_role_id: role.id }))}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                          formData.primary_role_id === role.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                        }`}>
                        {formData.primary_role_id === role.id && <Check className="w-3 h-3" strokeWidth={3} />}
                        {role.display_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── ШАГ 3: Компания ─── */}
        {step === 3 && (
          <div className="space-y-4">
            {(stoMissing || partsMissing) && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <p className="text-xs text-amber-700">Для роли владельца необходимо привязать компанию</p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Компания</p>
                    <p className="text-xs text-gray-400">Привязка к организации</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {isAdmin && shouldShowStoCompany(selectedRoleNames) && needsSto && !inlineForm && (
                    <button type="button" onClick={() => setInlineForm({ type: 'sto', name: '', phone: '', address: '' })}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-dashed border-indigo-300 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-50 transition-colors">
                      <Plus className="w-3.5 h-3.5" />СТО
                    </button>
                  )}
                  {isAdmin && shouldShowPartsCompany(selectedRoleNames) && needsParts && !inlineForm && (
                    <button type="button" onClick={() => setInlineForm({ type: 'parts', name: '', phone: '', address: '' })}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-dashed border-orange-300 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-50 transition-colors">
                      <Plus className="w-3.5 h-3.5" />Разборку
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {shouldShowStoCompany(selectedRoleNames) && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      СТО {needsSto && <span className="text-red-400">*</span>}
                      {formData.sto_company_id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </label>
                    <select value={formData.sto_company_id} onChange={e => setFormData(p => ({ ...p, sto_company_id: e.target.value }))}
                      disabled={isStoOwner && !isAdmin}
                      className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 transition-all disabled:opacity-60 ${stoMissing ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-100' : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-100'}`}>
                      <option value="">Выберите СТО</option>
                      {stoCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {shouldShowPartsCompany(selectedRoleNames) && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Авторазборка {needsParts && <span className="text-red-400">*</span>}
                      {formData.parts_company_id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </label>
                    <select value={formData.parts_company_id} onChange={e => setFormData(p => ({ ...p, parts_company_id: e.target.value }))}
                      disabled={isPartsOwner && !isAdmin}
                      className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 transition-all disabled:opacity-60 ${partsMissing ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-100' : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-100'}`}>
                      <option value="">Выберите авторазборку</option>
                      {partsCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Inline форма создания */}
                {inlineForm && (
                  <div className={`p-4 rounded-xl border space-y-3 ${inlineForm.type === 'sto' ? 'bg-indigo-50/60 border-indigo-200' : 'bg-orange-50/60 border-orange-200'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide ${inlineForm.type === 'sto' ? 'text-indigo-700' : 'text-orange-700'}`}>
                      Новое {inlineForm.type === 'sto' ? 'СТО' : 'авторазборка'}
                    </p>
                    <input autoFocus type="text" placeholder="Название *" value={inlineForm.name}
                      onChange={e => setInlineForm(p => p ? { ...p, name: e.target.value } : null)}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Телефон" value={inlineForm.phone}
                        onChange={e => setInlineForm(p => p ? { ...p, phone: e.target.value } : null)}
                        className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                      <input type="text" placeholder="Адрес" value={inlineForm.address}
                        onChange={e => setInlineForm(p => p ? { ...p, address: e.target.value } : null)}
                        className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setInlineForm(null)}
                        className="flex-1 py-2.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Отмена</button>
                      <button type="button" disabled={!inlineForm.name.trim() || createCompanyMutation.isPending}
                        onClick={() => createCompanyMutation.mutate(inlineForm)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-colors ${inlineForm.type === 'sto' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                        {createCompanyMutation.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                        Создать
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Мобильные кнопки */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex gap-3 z-40">
        <button onClick={handleBack} className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl">
          {step === 1 ? 'Отмена' : 'Назад'}
        </button>
        {step < totalSteps ? (
          <button onClick={handleNext} disabled={!canGoNext}
            className="flex-1 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
            Далее <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        ) : (
          <button onClick={() => updateMutation.mutate()} disabled={!canSave || updateMutation.isPending}
            className="flex-1 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
            {updateMutation.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2} />}
            Сохранить
          </button>
        )}
      </div>
    </div>
  )
}
