import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getUserRolesWithNames, getEmailByUsername } from '@/services/userService'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { getDefaultRouteForRoles } from '../config/navigation'
import { Wrench, Mail, Lock, AtSign, Eye, EyeOff, Package, ArrowRight, Cog } from 'lucide-react'

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [isForgotMode, setIsForgotMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают')
      return
    }

    // Валидация email (обязательное поле — вход по email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim()) {
      toast.error('Укажите электронную почту')
      return
    }
    if (!emailRegex.test(email.trim())) {
      toast.error('Введите корректный адрес электронной почты')
      return
    }
    if (password.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов')
      return
    }

    setLoading(true)

    const authEmail = email.trim()
    const realEmail = email.trim()

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          real_email: realEmail
        }
      }
    })

    if (error) {
      console.error('Registration error:', error)
      toast.error('Ошибка регистрации: ' + error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Отправляем уведомление админу о новой регистрации
      try {
        const token = data.session?.access_token || ''
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-user-registered`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              userId: data.user.id,
              username: null,
              email: authEmail,
              fullName: null,
            }),
          }
        )
      } catch (err) {
        console.error('Failed to send admin notification:', err)
      }

      if (data.session) {
        // Email confirmation отключён — пользователь сразу авторизован
        toast.success('Регистрация успешна!')
        await handleSuccessfulLogin()
      } else {
        // Email confirmation включён — просим войти вручную
        toast.success('Регистрация успешна! Подтвердите email и войдите в систему')
        setIsRegisterMode(false)
        setEmail('')
        setPassword('')
        setConfirmPassword('')
      }
    }

    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    let loginEmail = emailOrUsername.trim()

    // Фолбэк для старых аккаунтов, у которых вместо email — логин:
    // резолвим реальный email из профиля.
    if (!loginEmail.includes('@')) {
      const storedEmail = await getEmailByUsername(loginEmail)
      if (storedEmail) loginEmail = storedEmail
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('not confirmed') || msg.includes('confirm')) {
        toast.error('Email не подтверждён. Откройте письмо и перейдите по ссылке подтверждения.')
      } else {
        toast.error('Неверный email или пароль')
      }
      setLoading(false)
      return
    }

    await handleSuccessfulLogin()
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    // При успехе браузер уже редиректит на Google — код ниже выполнится только при ошибке.
    if (error) {
      toast.error('Не удалось войти через Google: ' + error.message)
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    let target = emailOrUsername.trim()
    if (!target) {
      toast.error('Введите email')
      return
    }
    if (!target.includes('@')) {
      const resolved = await getEmailByUsername(target)
      if (!resolved) {
        toast.error('Для этого логина не найден email. Обратитесь к администратору.')
        return
      }
      target = resolved
    }
    if (/@internal\.|@sto-worker\.local|@example\.com/.test(target)) {
      toast.error('У этого пользователя нет реальной почты. Администратор должен задать email.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) {
      toast.error('Не удалось отправить письмо: ' + error.message)
      return
    }
    toast.success(`Письмо для сброса пароля отправлено на ${target}`)
  }

  const handleSuccessfulLogin = async () => {
    // Получаем профиль пользователя для определения ролей
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { roleNames, primaryRoleName } = await getUserRolesWithNames(user.id)

      // КРИТИЧНО: Инвалидируем кэш профиля
      await queryClient.invalidateQueries({ queryKey: ['userProfile'] })

      // Если в URL есть ?next= и путь начинается с '/' — редиректим туда
      const nextParam = searchParams.get('next')
      if (nextParam && nextParam.startsWith('/')) {
        window.location.assign(nextParam)
        return
      }

      // Определяем куда направить пользователя на основе основной роли
      const defaultRoute = primaryRoleName
        ? getDefaultRouteForRoles([primaryRoleName])
        : getDefaultRouteForRoles(roleNames)

      // Полная навигация (не SPA): гарантирует, что приложение
      // перезапустится с уже сохранённой сессией и не отбросит на форму
      // из-за гонки обновления auth-состояния.
      window.location.assign(defaultRoute)
    }
  }

  const formTitle = isForgotMode
    ? 'Восстановление пароля'
    : isRegisterMode
    ? 'Создать аккаунт'
    : 'Добро пожаловать'

  const formSubtitle = isForgotMode
    ? 'Введите email — отправим ссылку для сброса пароля'
    : isRegisterMode
    ? 'Заполните данные для регистрации'
    : 'Войдите в свой аккаунт'

  return (
    <div
      className="flex min-h-dvh"
      style={{ background: '#080C14', fontFamily: "'Manrope Variable', 'Inter', system-ui, sans-serif" }}
    >

      {/* ─── Left brand panel ─────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{
          borderRight: '1px solid rgba(59,130,246,0.1)',
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.07) 1px,transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      >
        {/* Glow orbs */}
        <div
          className="absolute pointer-events-none"
          style={{ top: '-120px', right: '-120px', width: '480px', height: '480px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 65%)' }}
        />
        <div
          className="absolute pointer-events-none"
          style={{ bottom: '-80px', left: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.07) 0%,transparent 65%)' }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              background: 'linear-gradient(180deg,#3B82F6 0%,#2563EB 100%)',
              boxShadow: '0 2px 8px -2px rgba(37,99,235,0.55)',
            }}
          >
            <Wrench size={20} color="white" strokeWidth={1.5} />
          </div>
          <span
            className="font-extrabold"
            style={{ color: '#F1F5F9', fontSize: '20px', letterSpacing: '-0.025em' }}
          >
            TSP <span style={{ color: '#3B82F6' }}>CRM</span>
          </span>
        </div>

        {/* Hero text */}
        <div className="relative">
          <h1
            className="font-extrabold mb-6"
            style={{ color: '#F1F5F9', fontSize: '72px', lineHeight: '0.94', letterSpacing: '-0.04em' }}
          >
            Авто<br />
            <span className="text-gradient-brand">бизнес</span><br />
            под<br />
            контролем
          </h1>
          <p style={{ color: '#64748B', fontSize: '15px', maxWidth: '300px', lineHeight: '1.7' }}>
            Система управления для авторазборки.
            Запчасти, заказы, клиенты — всё в одном месте.
          </p>
        </div>

        {/* Feature chips */}
        <div className="relative flex flex-wrap gap-3">
          {[
            { label: 'Разборка', sub: 'складской учёт' },
            { label: 'Запчасти', sub: 'каталог и цены' },
            { label: 'Клиенты', sub: 'история заказов' },
          ].map(({ label, sub }) => (
            <div
              key={label}
              className="rounded-xl px-3.5 py-2"
              style={{
                background: 'rgba(37,99,235,0.1)',
                border: '1px solid rgba(59,130,246,0.18)',
              }}
            >
              <div className="font-bold text-xs" style={{ color: '#60A5FA', letterSpacing: '0.01em' }}>{label}</div>
              <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Right form panel ─────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: '#0D1117', padding: 'clamp(16px,4vw,40px) 16px' }}
      >
        <div className="w-full" style={{ maxWidth: '360px' }}>

          {/* Mobile logo */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden flex items-center justify-center gap-2.5 mb-10"
          >
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(180deg,#3B82F6 0%,#2563EB 100%)',
                boxShadow: '0 2px 8px -2px rgba(37,99,235,0.5)',
              }}
            >
              <Wrench size={17} color="white" strokeWidth={1.5} />
            </div>
            <span
              className="font-extrabold"
              style={{ color: '#F1F5F9', fontSize: '18px', letterSpacing: '-0.025em' }}
            >
              TSP <span style={{ color: '#3B82F6' }}>CRM</span>
            </span>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${isForgotMode}-${isRegisterMode}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2
                className="font-extrabold mb-1"
                style={{ color: '#F1F5F9', fontSize: '22px', letterSpacing: '-0.025em' }}
              >
                {formTitle}
              </h2>
              <p className="text-sm mb-7" style={{ color: '#64748B' }}>
                {formSubtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={isForgotMode ? handleForgotPassword : isRegisterMode ? handleRegister : handleLogin}>

            <div className="flex flex-col gap-4 mb-4">
              {isRegisterMode ? (
                <div>
                  <label htmlFor="email" className="form-label" style={{ color: '#94A3B8' }}>Email</label>
                  <div className="relative">
                    <Mail
                      size={16}
                      strokeWidth={1.5}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: '#475569' }}
                    />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      placeholder="email@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(148,163,184,0.2)',
                        color: '#F1F5F9',
                        outline: 'none',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.14)' }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(148,163,184,0.2)'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="emailOrUsername" className="form-label" style={{ color: '#94A3B8' }}>Email</label>
                  <div className="relative">
                    <AtSign
                      size={16}
                      strokeWidth={1.5}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: '#475569' }}
                    />
                    <input
                      id="emailOrUsername"
                      type="email"
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="email@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(148,163,184,0.2)',
                        color: '#F1F5F9',
                        outline: 'none',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.14)' }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(148,163,184,0.2)'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {!isForgotMode && (
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label htmlFor="password" className="form-label mb-0" style={{ color: '#94A3B8' }}>Пароль</label>
                    {!isRegisterMode && (
                      <button
                        type="button"
                        onClick={() => setIsForgotMode(true)}
                        disabled={loading}
                        className="text-xs font-medium transition-colors duration-150"
                        style={{ color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onMouseOver={e => (e.currentTarget.style.color = '#60A5FA')}
                        onMouseOut={e => (e.currentTarget.style.color = '#3B82F6')}
                      >
                        Забыли пароль?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock
                      size={16}
                      strokeWidth={1.5}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: '#475569' }}
                    />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                      placeholder={isRegisterMode ? 'Минимум 6 символов' : 'Введите пароль'}
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl text-sm transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(148,163,184,0.2)',
                        color: '#F1F5F9',
                        outline: 'none',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.14)' }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(148,163,184,0.2)'; e.target.style.boxShadow = 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                      aria-label="Показать пароль"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all duration-150"
                      style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)' }}
                      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                    >
                      {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                {isRegisterMode && (
                  <div>
                    <label htmlFor="confirmPassword" className="form-label" style={{ color: '#94A3B8' }}>Повторите пароль</label>
                    <div className="relative">
                      <Lock
                        size={16}
                        strokeWidth={1.5}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: '#475569' }}
                      />
                      <input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Ещё раз тот же пароль"
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl text-sm transition-all duration-200"
                        style={{
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(148,163,184,0.2)',
                          color: '#F1F5F9',
                          outline: 'none',
                        }}
                        onFocus={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.14)' }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(148,163,184,0.2)'; e.target.style.boxShadow = 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        tabIndex={-1}
                        aria-label="Показать пароль"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all duration-150"
                        style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)' }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                      >
                        {showConfirm ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-55"
              style={{
                background: 'linear-gradient(180deg,#3B82F6 0%,#2563EB 100%)',
                boxShadow: '0 1px 2px rgba(37,99,235,0.35),0 4px 12px -2px rgba(37,99,235,0.4)',
                border: 'none',
                letterSpacing: '-0.01em',
              }}
            >
              {loading
                ? (isForgotMode ? 'Отправка...' : isRegisterMode ? 'Регистрация...' : 'Вход...')
                : (isForgotMode ? 'Отправить ссылку' : isRegisterMode ? 'Зарегистрироваться' : 'Войти')}
            </button>

            {/* Google + divider */}
            {!isForgotMode && !isRegisterMode && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <span className="text-xs font-medium" style={{ color: '#475569' }}>или</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.97] disabled:opacity-55"
                  style={{ background: '#FFFFFF', color: '#1F2937', border: 'none' }}
                  onMouseOver={e => (e.currentTarget.style.opacity = '0.92')}
                  onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                >
                  <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/>
                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                  </svg>
                  Войти через Google
                </button>
              </>
            )}

            {/* Mode switcher */}
            <div
              className="mt-5 pt-4 text-center"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              {isForgotMode ? (
                <button
                  type="button"
                  onClick={() => setIsForgotMode(false)}
                  className="text-sm font-medium transition-colors duration-150"
                  style={{ color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseOver={e => (e.currentTarget.style.color = '#60A5FA')}
                  onMouseOut={e => (e.currentTarget.style.color = '#3B82F6')}
                >
                  ← Вернуться ко входу
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode)
                    setEmail('')
                    setConfirmPassword('')
                  }}
                  className="text-sm font-medium transition-colors duration-150"
                  style={{ color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseOver={e => (e.currentTarget.style.color = '#60A5FA')}
                  onMouseOut={e => (e.currentTarget.style.color = '#3B82F6')}
                >
                  {isRegisterMode ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                </button>
              )}
            </div>

          </form>

          {/* Catalog link */}
          <div className="text-center mt-4 flex flex-col items-center gap-2">
            <Link
              to="/market"
              className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
              style={{ color: '#475569', textDecoration: 'none' }}
              onMouseOver={e => (e.currentTarget.style.color = '#94A3B8')}
              onMouseOut={e => (e.currentTarget.style.color = '#475569')}
            >
              <Package size={13} strokeWidth={1.5} />
              Смотреть каталог запчастей
              <ArrowRight size={12} strokeWidth={2} />
            </Link>
            <Link
              to="/business"
              className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
              style={{ color: '#3B82F6', textDecoration: 'none' }}
              onMouseOver={e => (e.currentTarget.style.color = '#60A5FA')}
              onMouseOut={e => (e.currentTarget.style.color = '#3B82F6')}
            >
              <Cog size={13} strokeWidth={1.5} />
              Открыть авторазборку
              <ArrowRight size={12} strokeWidth={2} />
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
