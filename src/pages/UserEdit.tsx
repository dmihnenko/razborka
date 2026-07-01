import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, User, Shield, ChevronRight, Check, LogIn, Power, Trash2 } from 'lucide-react'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useIsAdmin, useUserProfile } from '@/hooks/useUserProfile'
import RoleSelector from '@/components/admin/RoleSelector'
import { updateUserProfile, updateUserRoles, fetchUserProfileForEdit, fetchAllActiveRoles, adminUpdateUser, toggleUserActive, softDeleteUserProfile } from '@/services/userService'
import { startImpersonation } from '@/services/impersonationService'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface Role { id: string; name: string; display_name: string; description: string | null; is_active: boolean }
/** Строка user_roles из fetchUserProfileForEdit. */
interface UserRoleRow { role_id: string; is_primary: boolean }
type Step = 1 | 2

const STEPS = [
  { num: 1, label: 'Профиль' },
  { num: 2, label: 'Роль' },
] as const

export default function UserEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = useIsAdmin()
  const { data: currentUserProfile } = useUserProfile()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const isPartsOwner = currentUserProfile?.roles?.some((r: { name: string }) => r.name === 'parts_owner') || false

  const [step, setStep] = useState<Step>(1)

  const [formData, setFormData] = useState({
    full_name: '', phone: '', username: '', email: '', password: '',
    role_ids: [] as string[], primary_role_id: '',
    parts_company_id: '',
  })

  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['admin-user-profile', id],
    enabled: !!id,
    queryFn: () => fetchUserProfileForEdit(id!)
  })

  useEffect(() => {
    // Сбрасываем форму при смене пользователя или при загрузке профиля
    if (userProfile) {
      const userRoles = (userProfile.user_roles || []) as UserRoleRow[]
      const primary = userRoles.find(r => r.is_primary)
      const roleIds = userRoles.map(r => r.role_id)
      setFormData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
        username: userProfile.username || '',
        email: userProfile.email || '',
        password: '',
        role_ids: roleIds,
        primary_role_id: primary?.role_id || roleIds[0] || '',
        parts_company_id: userProfile.parts_company_id || '',
      })
    }
  }, [id, userProfile])  // id в зависимостях — сброс при смене пользователя

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => fetchAllActiveRoles() as Promise<Role[]>
  })

  const allowedRoles = useMemo(() => roles.filter(role => {
    if (role.name === 'user') return false
    if (isAdmin) return true
    if (isPartsOwner) return role.name === 'parts_worker'
    return false
  }), [roles, isAdmin, isPartsOwner])

  const totalSteps: Step = 2
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
      // Админ может сменить email и/или задать новый пароль (через Edge Function)
      if (isAdmin) {
        const emailChanged = !!formData.email.trim() && formData.email.trim() !== (userProfile?.email || '')
        const wantsPassword = formData.password.trim().length > 0
        if (emailChanged || wantsPassword) {
          await adminUpdateUser({
            userId: id!,
            email: emailChanged ? formData.email.trim() : undefined,
            password: wantsPassword ? formData.password : undefined,
          })
        }
      }
      await updateUserProfile({ userId: id!, full_name: formData.full_name, phone: formData.phone, parts_company_id: formData.parts_company_id || null })
      await updateUserRoles({ userId: id!, role_ids: formData.role_ids, primary_role_id: formData.primary_role_id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-profile'] })
      toast.success('Сохранено')
      navigate(-1)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  // ── Действия над аккаунтом (admin) ──
  const targetIsAdmin = useMemo(
    () => formData.role_ids.some(rid => roles.find(r => r.id === rid)?.name === 'admin'),
    [formData.role_ids, roles],
  )

  const toggleActiveMutation = useMutation({
    mutationFn: () => toggleUserActive(id!, !!userProfile?.is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-profile', id] })
      toast.success('Статус изменён')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => softDeleteUserProfile(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Пользователь перемещён в корзину')
      navigate(-1)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const handleImpersonate = async () => {
    const ok = await showConfirm({ message: `Войти под пользователем ${userProfile?.full_name || userProfile?.email}? Вы сможете вернуться в свой аккаунт.` })
    if (!ok) return
    try {
      toast.loading('Вход...', { id: 'imp' })
      await startImpersonation(id!)
      toast.dismiss('imp')
      window.location.href = '/'
    } catch (e) {
      toast.dismiss('imp')
      toast.error(e instanceof Error ? e.message : 'Не удалось войти')
    }
  }

  const handleDelete = async () => {
    const ok = await showConfirm({ message: `Переместить пользователя ${userProfile?.full_name || userProfile?.email} в корзину? Его можно будет восстановить.`, danger: true })
    if (!ok) return
    deleteMutation.mutate()
  }

  const canGoNext = step === 1 ? true : step === 2 ? formData.role_ids.length > 0 : true
  const canSave = formData.role_ids.length > 0

  const handleNext = () => {
    if (step < totalSteps) setStep((step + 1) as Step)
    else updateMutation.mutate()
  }
  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step)
    else navigate(-1)
  }

  if (isLoading) return (
    <div className="min-h-dvh bg-[var(--cab-bg)] flex items-center justify-center">
      <span className="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--cab-signal)' }} />
    </div>
  )

  if (!userProfile) return (
    <div className="min-h-dvh bg-[var(--cab-bg)] flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Пользователь не найден</p>
        <button onClick={() => navigate(-1)} className="text-sm hover:underline" style={{ color: 'var(--cab-signal)' }}>← Назад</button>
      </div>
    </div>
  )

  const avatarLetter = (userProfile.full_name || userProfile.username || userProfile.email || '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-dvh bg-[var(--cab-bg)] flex flex-col">
      {/* Хедер */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200/80 shadow-sm">
        <div className="px-4 h-14 flex items-center gap-3">
          <button onClick={handleBack} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{userProfile.full_name || userProfile.username || userProfile.email}</p>
            <p className="text-[11px] text-gray-500">Шаг {step} из {totalSteps}</p>
          </div>
          {step === totalSteps ? (
            <button onClick={() => updateMutation.mutate()} disabled={!canSave || updateMutation.isPending}
              className="cab-btn cab-btn-primary disabled:opacity-40">
              {updateMutation.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2} />}
              Сохранить
            </button>
          ) : (
            <button onClick={handleNext} disabled={!canGoNext}
              className="cab-btn cab-btn-primary disabled:opacity-40">
              Далее <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Прогресс */}
        <div className="px-4 pb-3 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const done = step > s.num
            const active = step === s.num
            return (
              <div key={s.num} className="flex items-center gap-2 flex-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                  style={
                    done
                      ? { background: 'var(--cab-signal)', color: '#fff' }
                      : active
                      ? { background: 'var(--cab-signal-weak)', color: 'var(--cab-signal)', boxShadow: '0 0 0 2px var(--cab-signal)' }
                      : { background: 'var(--cab-surface-2)', color: 'var(--cab-ink-3)' }
                  }
                >
                  {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : s.num}
                </div>
                <span className="text-xs font-medium" style={active ? { color: 'var(--cab-signal)' } : { color: 'var(--cab-ink-3)' }}>{s.label}</span>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 rounded-full" style={done ? { background: 'var(--cab-signal)' } : { background: 'var(--cab-border)' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] w-full">

        {/* Карточка пользователя */}
        <div className="card p-4 mb-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-sm" style={{ background: 'var(--brand-gradient)' }}>
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{userProfile.full_name || 'Имя не указано'}</p>
            <p className="text-xs text-gray-500 truncate">{userProfile.email}</p>
          </div>
          <span className={`badge flex-shrink-0 ${userProfile.is_active ? 'badge-green' : 'badge-gray'}`}>
            {userProfile.is_active ? 'Активен' : 'Неактивен'}
          </span>
        </div>

        {/* ─── ШАГ 1: Профиль ─── */}
        {step === 1 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="icon-tile-sm bg-blue-50">
                <User className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Профиль</p>
                <p className="text-xs text-gray-500">Личные данные</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">ФИО</label>
                <input type="text" value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Иванов Иван Иванович"
                  className="form-input" />
              </div>
              {isAdmin && (
                <div>
                  <label className="form-label">Логин (username)</label>
                  <input type="text" value={formData.username}
                    onChange={e => setFormData(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    placeholder="username" autoComplete="off"
                    className="form-input font-mono" />
                  <p className="text-xs text-gray-500 mt-1">Только латиница, цифры, _ (3-30 символов)</p>
                </div>
              )}
              {isAdmin && (
                <div>
                  <label className="form-label">Email</label>
                  <input type="email" value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com" autoComplete="off"
                    className="form-input" />
                  <p className="text-xs text-gray-500 mt-1">Используется для входа и восстановления пароля</p>
                </div>
              )}
              {isAdmin && (
                <div>
                  <label className="form-label">Новый пароль</label>
                  <input type="text" value={formData.password}
                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    placeholder="Оставьте пустым, чтобы не менять" autoComplete="new-password"
                    className="form-input" />
                  <p className="text-xs text-gray-500 mt-1">Минимум 6 символов. Заполняйте только при смене пароля</p>
                </div>
              )}
              <div>
                <label className="form-label">Телефон</label>
                <IMaskInput mask="+380 00 000-00-00" value={formData.phone}
                  onAccept={v => setFormData(p => ({ ...p, phone: String(v) }))}
                  placeholder="+380 XX XXX-XX-XX"
                  className="form-input" />
              </div>
            </div>
          </div>
        )}

        {/* ─── ШАГ 2: Роли ─── */}
        {step === 2 && (
          <div className="card p-0 overflow-visible">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="icon-tile-sm" style={{ background: 'var(--cab-signal-weak)' }}>
                <Shield className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--cab-signal)' }} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Роль <span className="text-red-500">*</span></p>
                <p className="text-xs text-gray-500">Права доступа</p>
              </div>
            </div>
            <div className="p-5">
              <RoleSelector
                roles={allowedRoles}
                selectedIds={formData.role_ids}
                primaryId={formData.primary_role_id}
                onChange={(ids, pid) => setFormData(p => ({ ...p, role_ids: ids, primary_role_id: pid }))}
              />
            </div>
          </div>
        )}

        {/* ── Действия над аккаунтом ── */}
        {isAdmin && (
          <div className="card p-0 overflow-hidden mt-5">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800">Действия</p>
              <p className="text-xs text-gray-500">Управление аккаунтом</p>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {!targetIsAdmin && (
                <button onClick={handleImpersonate} className="cab-btn cab-btn-secondary cab-btn-sm">
                  <LogIn className="w-4 h-4" /> Войти как
                </button>
              )}
              <button onClick={() => toggleActiveMutation.mutate()} disabled={toggleActiveMutation.isPending}
                className="cab-btn cab-btn-secondary cab-btn-sm">
                <Power className="w-4 h-4" /> {userProfile.is_active ? 'Деактивировать' : 'Активировать'}
              </button>
              {!targetIsAdmin && (
                <button onClick={handleDelete} className="cab-btn cab-btn-danger cab-btn-sm">
                  <Trash2 className="w-4 h-4" /> В корзину
                </button>
              )}
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
            className="cab-btn cab-btn-primary flex-1 disabled:opacity-40">
            Далее <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        ) : (
          <button onClick={() => updateMutation.mutate()} disabled={!canSave || updateMutation.isPending}
            className="cab-btn cab-btn-primary flex-1 disabled:opacity-40">
            {updateMutation.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2} />}
            Сохранить
          </button>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
