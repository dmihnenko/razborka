import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getUserRolesWithNames, getEmailByUsername } from '@/services/userService'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { getDefaultRouteForRoles } from '../config/navigation'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

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
      style={{
        fontFamily: "'Manrope Variable', 'Inter', system-ui, sans-serif",
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >

      {/* ─── Форма входа ─────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col overflow-y-auto bg-gray-50"
        style={{ minWidth: 0 }}
      >
        <div
          className="m-auto w-full"
          style={{
            maxWidth: '400px',
            padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 40px)',
          }}
        >

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center justify-center mb-8"
            >
              <Logo size="md" withText />
            </motion.div>

            {/* Form heading */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`heading-${isForgotMode}-${isRegisterMode}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="mb-7"
              >
                <h1
                  className="text-gray-900 font-extrabold mb-1.5"
                  style={{ fontSize: 'clamp(22px, 4vw, 28px)', letterSpacing: '-0.03em' }}
                >
                  {formTitle}
                </h1>
                <p className="text-sm leading-relaxed text-gray-500">
                  {formSubtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Form */}
            <AnimatePresence mode="wait">
              <motion.form
                key={`form-${isForgotMode}-${isRegisterMode}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={isForgotMode ? handleForgotPassword : isRegisterMode ? handleRegister : handleLogin}
                noValidate
              >
                <div className="flex flex-col gap-4 mb-4">

                  {/* Email / emailOrUsername field */}
                  {isRegisterMode ? (
                    <div>
                      <label
                        htmlFor="reg-email"
                        className="form-label"
                      >
                        Email
                      </label>
                      <div className="relative">
                        <Mail
                          size={15}
                          strokeWidth={1.5}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
                          aria-hidden="true"
                        />
                        <input
                          id="reg-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          required
                          placeholder="email@example.com"
                          className="form-input w-full pl-10 pr-3.5"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="emailOrUsername"
                        className="form-label"
                      >
                        Email
                      </label>
                      <div className="relative">
                        <Mail
                          size={15}
                          strokeWidth={1.5}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
                          aria-hidden="true"
                        />
                        <input
                          id="emailOrUsername"
                          type="email"
                          inputMode="email"
                          value={emailOrUsername}
                          onChange={(e) => setEmailOrUsername(e.target.value)}
                          required
                          autoComplete="email"
                          placeholder="email@example.com"
                          className="form-input w-full pl-10 pr-3.5"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Password fields (not shown in forgot mode) */}
                {!isForgotMode && (
                  <div className="flex flex-col gap-4 mb-6">
                    <div>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <label
                          htmlFor="password"
                          className="form-label !mb-0"
                        >
                          Пароль
                        </label>
                        {!isRegisterMode && (
                          <button
                            type="button"
                            onClick={() => setIsForgotMode(true)}
                            disabled={loading}
                            className="text-xs font-semibold text-primary hover:text-blue-700 transition-colors duration-150 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                            style={{ padding: '2px 4px', minHeight: '28px' }}
                          >
                            Забыли пароль?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock
                          size={15}
                          strokeWidth={1.5}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
                          aria-hidden="true"
                        />
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                          placeholder={isRegisterMode ? 'Минимум 6 символов' : 'Введите пароль'}
                          className="form-input w-full pl-10 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          tabIndex={-1}
                          aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {showPassword
                            ? <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
                            : <Eye size={16} strokeWidth={1.5} aria-hidden="true" />}
                        </button>
                      </div>
                    </div>

                    {isRegisterMode && (
                      <div>
                        <label
                          htmlFor="confirmPassword"
                          className="form-label"
                        >
                          Повторите пароль
                        </label>
                        <div className="relative">
                          <Lock
                            size={15}
                            strokeWidth={1.5}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
                            aria-hidden="true"
                          />
                          <input
                            id="confirmPassword"
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            placeholder="Ещё раз тот же пароль"
                            className="form-input w-full pl-10 pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(v => !v)}
                            tabIndex={-1}
                            aria-label={showConfirm ? 'Скрыть подтверждение пароля' : 'Показать подтверждение пароля'}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {showConfirm
                              ? <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
                              : <Eye size={16} strokeWidth={1.5} aria-hidden="true" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary btn-touch w-full rounded-xl font-semibold active:scale-[0.97] transition-transform duration-150 mt-2"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {loading
                    ? (isForgotMode ? 'Отправка...' : isRegisterMode ? 'Регистрация...' : 'Вход...')
                    : (isForgotMode ? 'Отправить ссылку' : isRegisterMode ? 'Зарегистрироваться' : 'Войти')}
                </button>

                {/* Google OAuth + divider (login mode only) */}
                {!isForgotMode && !isRegisterMode && (
                  <>
                    <div className="flex items-center gap-3 my-5" role="separator" aria-hidden="true">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs font-medium text-gray-400">или</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      aria-label="Войти через Google"
                      className="btn-secondary btn-touch w-full"
                    >
                      <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
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
                <div className="mt-5 pt-4 text-center border-t border-gray-200">
                  {isForgotMode ? (
                    <button
                      type="button"
                      onClick={() => setIsForgotMode(false)}
                      className="inline-flex items-center justify-center min-h-[44px] px-2 text-sm font-semibold text-primary hover:text-blue-700 transition-colors duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
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
                      className="inline-flex items-center justify-center min-h-[44px] px-2 text-sm font-semibold text-primary hover:text-blue-700 transition-colors duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    >
                      {isRegisterMode ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                    </button>
                  )}
                </div>
              </motion.form>
            </AnimatePresence>

        </div>
      </div>
    </div>
  )
}
