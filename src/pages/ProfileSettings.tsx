import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Lock, Eye, EyeOff, Save, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'

export default function ProfileSettings() {
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()

  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Обновление профиля
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
        })
        .eq('id', profile!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      toast.success('Профиль обновлён')
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка при обновлении профиля'),
  })

  // Смена пароля
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('Пароли не совпадают')
      }
      if (passwordForm.newPassword.length < 6) {
        throw new Error('Пароль должен быть не менее 6 символов')
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      })
      if (error) throw error

    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Пароль изменён')
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка при смене пароля'),
  })

  const passwordValid =
    passwordForm.newPassword.length >= 6 &&
    passwordForm.newPassword === passwordForm.confirmPassword

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Заголовок */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <span>Настройки</span>
        <ChevronRight className="w-4 h-4" />
        <span className="font-semibold text-gray-900">Мой профиль</span>
      </div>

      {/* Информация об аккаунте */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Аккаунт</h2>
            <p className="text-xs text-gray-500">Ваши данные для входа</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Логин</span>
            <span className="text-sm font-medium text-gray-900 font-mono">{profile?.username || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900">{profile?.email || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Роль</span>
            <span className="text-sm font-medium text-gray-900">
              {profile?.roles?.find((r: any) => r.is_primary)?.display_name || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Редактирование профиля */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <User className="w-4 h-4 text-purple-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Личные данные</h2>
            <p className="text-xs text-gray-500">Имя и контакты</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ФИО</label>
            <input
              type="text"
              value={profileForm.full_name}
              onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Иванов Иван Иванович"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Телефон</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="+380 XX XXX-XX-XX"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-700 text-white text-sm font-semibold rounded-xl hover:bg-purple-800 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {updateProfileMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      {/* Смена пароля */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <Lock className="w-4 h-4 text-orange-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Смена пароля</h2>
            <p className="text-xs text-gray-500">Минимум 6 символов</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Новый пароль</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Новый пароль"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordForm.newPassword.length > 0 && passwordForm.newPassword.length < 6 && (
              <p className="text-xs text-red-500 mt-1">Минимум 6 символов</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Подтвердите пароль</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Повторите пароль"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordForm.confirmPassword.length > 0 && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Пароли не совпадают</p>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => changePasswordMutation.mutate()}
              disabled={!passwordValid || changePasswordMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              <Lock className="w-4 h-4" />
              {changePasswordMutation.isPending ? 'Сохранение...' : 'Сменить пароль'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
