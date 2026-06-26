import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { User, Lock, Eye, EyeOff, Save, ChevronRight, Send, Phone, MapPin, Mail, Truck, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateProfile, changePassword } from '../services/userService'
import { getPartsCompanyContacts, updatePartsCompanyContacts } from '../services/companyService'
import { useUserProfile } from '@/hooks/useUserProfile'

export default function ProfileSettings() {
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()

  // Контакты разборки (только для владельца разборки)
  const isPartsOwner = profile?.roles?.some((r: any) => r.name === 'parts_owner')
  const partsCompanyId = profile?.parts_company_id
  const showPartsContacts = !!partsCompanyId && !!isPartsOwner

  const { data: partsContacts } = useQuery({
    queryKey: ['parts-company-contacts', partsCompanyId],
    queryFn: () => getPartsCompanyContacts(partsCompanyId!),
    enabled: showPartsContacts,
  })
  const [contactForm, setContactForm] = useState({ phone: '', telegram: '', address: '', email: '' })
  useEffect(() => {
    if (partsContacts) {
      setContactForm({
        phone: partsContacts.phone || '',
        telegram: partsContacts.telegram || '',
        address: partsContacts.address || '',
        email: partsContacts.email || '',
      })
    }
  }, [partsContacts])

  const saveContacts = useMutation({
    mutationFn: () => updatePartsCompanyContacts(partsCompanyId!, {
      phone: contactForm.phone.trim() || null,
      telegram: contactForm.telegram.trim() || null,
      address: contactForm.address.trim() || null,
      email: contactForm.email.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-company-contacts', partsCompanyId] })
      queryClient.invalidateQueries({ queryKey: ['public-parts-company'] })
      toast.success('Контакты разборки сохранены')
    },
    onError: () => toast.error('Не удалось сохранить контакты'),
  })

  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
  })

  // Данные доставки (Нова Пошта) — обычные текстовые поля
  const [deliveryForm, setDeliveryForm] = useState({
    np_city: profile?.np_city || '',
    np_warehouse: profile?.np_warehouse || '',
  })
  useEffect(() => {
    if (profile) {
      setDeliveryForm({
        np_city: profile.np_city || '',
        np_warehouse: profile.np_warehouse || '',
      })
    }
  }, [profile?.np_city, profile?.np_warehouse])

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
      await updateProfile({
        userId: profile!.id,
        full_name: profileForm.full_name,
        phone: profileForm.phone,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      toast.success('Профиль обновлён')
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка при обновлении профиля'),
  })

  // Сохранение данных доставки (Нова Пошта)
  const saveDeliveryMutation = useMutation({
    mutationFn: async () => {
      await updateProfile({
        userId: profile!.id,
        full_name: profile?.full_name || '',
        phone: profile?.phone || '',
        np_city: deliveryForm.np_city,
        np_warehouse: deliveryForm.np_warehouse,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      toast.success('Данные доставки сохранены')
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка при сохранении доставки'),
  })

  // Смена пароля
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('Пароли не совпадают')
      }
      await changePassword(passwordForm.newPassword)
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
    <div className="w-full space-y-5">
      {/* Заголовок */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <span>Настройки</span>
        <ChevronRight className="w-4 h-4" />
        <span className="font-semibold text-gray-900">Мой профиль</span>
      </div>

      <div className="columns-1 lg:columns-2 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid">

      {/* Информация об аккаунте */}
      <div className="cab-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="icon-tile-sm bg-slate-100">
            <User className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Аккаунт</h2>
            <p className="text-xs text-gray-500">Ваши данные для входа</p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900">{profile?.email || '—'}</span>
          </div>
        </div>
      </div>

      {/* Редактирование профиля */}
      <div className="cab-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="icon-tile-sm bg-slate-100">
            <User className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Личные данные</h2>
            <p className="text-xs text-gray-500">Имя и контакты</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label">ФИО</label>
            <input
              type="text"
              value={profileForm.full_name}
              onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
              className="form-input"
              placeholder="Иванов Иван Иванович"
            />
          </div>
          <div>
            <label className="form-label">Телефон</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="form-input"
              placeholder="+380 XX XXX-XX-XX"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending}
              className="cab-btn cab-btn-primary"
            >
              <Save className="w-4 h-4" />
              {updateProfileMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      {/* Доставка (Нова Пошта) — для предзаполнения заказов на маркете */}
      <div className="cab-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="icon-tile-sm bg-slate-100">
            <Truck className="w-4 h-4 text-slate-700" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Доставка (Нова Пошта)</h2>
            <p className="text-xs text-gray-500">Подставим в ваши заказы на маркете</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[var(--cab-ink-3)]" strokeWidth={1.5} /> Город</label>
            <input
              type="text"
              value={deliveryForm.np_city}
              onChange={e => setDeliveryForm(f => ({ ...f, np_city: e.target.value }))}
              className="form-input"
              placeholder="Київ"
            />
          </div>
          <div>
            <label className="form-label flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-[var(--cab-ink-3)]" strokeWidth={1.5} /> Отделение Новой Почты</label>
            <input
              type="text"
              value={deliveryForm.np_warehouse}
              onChange={e => setDeliveryForm(f => ({ ...f, np_warehouse: e.target.value }))}
              className="form-input"
              placeholder="Відділення №5"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => saveDeliveryMutation.mutate()}
              disabled={saveDeliveryMutation.isPending}
              className="cab-btn cab-btn-primary"
            >
              <Save className="w-4 h-4" />
              {saveDeliveryMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      {/* Контакты разборки — для покупателей на публичной странице */}
      {showPartsContacts && (
        <div className="cab-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="icon-tile-sm bg-slate-100">
              <Send className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Контакты разборки</h2>
              <p className="text-xs text-gray-500">Показываются покупателям на публичной странице запчасти</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="form-label flex items-center gap-1.5"><Send className="w-3.5 h-3.5 text-[var(--cab-ink-3)]" /> Telegram</label>
              <input
                type="text"
                value={contactForm.telegram}
                onChange={e => setContactForm(f => ({ ...f, telegram: e.target.value }))}
                placeholder="@username или https://t.me/username"
                className="form-input"
              />
              <p className="text-xs text-gray-500 mt-1">Чтобы покупатели могли написать вам в Telegram</p>
            </div>
            <div>
              <label className="form-label flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-[var(--cab-ink-3)]" /> Телефон</label>
              <input
                type="tel"
                value={contactForm.phone}
                onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+380 XX XXX-XX-XX"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[var(--cab-ink-3)]" /> Адрес / город</label>
              <input
                type="text"
                value={contactForm.address}
                onChange={e => setContactForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Город, улица"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-[var(--cab-ink-3)]" /> Email</label>
              <input
                type="email"
                value={contactForm.email}
                onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="form-input"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => saveContacts.mutate()}
                disabled={saveContacts.isPending}
                className="cab-btn cab-btn-primary"
              >
                <Save className="w-4 h-4" />
                {saveContacts.isPending ? 'Сохранение...' : 'Сохранить контакты'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Смена пароля */}
      <div className="cab-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="icon-tile-sm bg-slate-100">
            <Lock className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Смена пароля</h2>
            <p className="text-xs text-gray-500">Минимум 6 символов</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label">Новый пароль</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="form-input pr-10"
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
            <label className="form-label">Подтвердите пароль</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="form-input pr-10"
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
              className="cab-btn cab-btn-primary"
            >
              <Lock className="w-4 h-4" />
              {changePasswordMutation.isPending ? 'Сохранение...' : 'Сменить пароль'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
