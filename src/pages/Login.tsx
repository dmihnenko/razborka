import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getUserRolesWithNames } from '@/services/userService'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { getDefaultRouteForRoles } from '../config/navigation'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

export default function Login() {
  const { t } = useTranslation('auth')
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [isForgotMode, setIsForgotMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  // Инлайн-ошибка регистрации, привязанная к полю (a11y), в дополнение к тосту.
  const [fieldError, setFieldError] = useState<{ field: 'email' | 'password' | 'confirm'; msg: string } | null>(null)
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError(null)

    if (password !== confirmPassword) {
      const msg = 'Пароли не совпадают'
      setFieldError({ field: 'confirm', msg })
      toast.error(msg)
      return
    }

    // Валидация email (обязательное поле — вход по email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim()) {
      const msg = 'Укажите электронную почту'
      setFieldError({ field: 'email', msg })
      toast.error(msg)
      return
    }
    if (!emailRegex.test(email.trim())) {
      const msg = 'Введите корректный адрес электронной почты'
      setFieldError({ field: 'email', msg })
      toast.error(msg)
      return
    }
    if (password.length < 6) {
      const msg = 'Пароль должен содержать минимум 6 символов'
      setFieldError({ field: 'password', msg })
      toast.error(msg)
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
      // Уведомление админу о новой регистрации — только при наличии сессии
      // (Edge-функция требует валидный JWT; при включённом email-подтверждении
      // сессии ещё нет — тогда уведомление просто пропускаем).
      const token = data.session?.access_token
      if (token) {
        try {
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

    const loginEmail = emailOrUsername.trim()

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
    const target = emailOrUsername.trim()
    if (!target) {
      toast.error('Введите email')
      return
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
    ? t('forgotTitle')
    : isRegisterMode
    ? t('createAccount')
    : t('welcome')

  const formSubtitle = isForgotMode
    ? t('forgotSubtitle')
    : isRegisterMode
    ? t('registerSubtitle')
    : t('loginSubtitle')

  return (
    <div
      className="flex min-h-dvh"
      style={{
        fontFamily: 'var(--font-sans)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >

      {/* ─── Форма входа ─────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ minWidth: 0, background: 'var(--cab-bg)' }}
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
              className="flex items-center justify-center mb-4"
            >
              <Link to="/market" aria-label="На маркет запчастей" className="inline-flex">
                <Logo size="sm" withText />
              </Link>
            </motion.div>

            {/* Карточка формы — единый стиль Ink & Signal */}
            <div className="cab-card p-5 sm:p-6">

            {/* Form heading — только для регистрации/восстановления (для входа лишнее) */}
            {(isForgotMode || isRegisterMode) && (
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
            )}

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
                        {t('email')}
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
                          onChange={(e) => { setEmail(e.target.value); if (fieldError?.field === 'email') setFieldError(null) }}
                          autoComplete="email"
                          required
                          placeholder="email@example.com"
                          className="form-input w-full pl-10 pr-3.5"
                          aria-invalid={fieldError?.field === 'email' || undefined}
                          aria-describedby={fieldError?.field === 'email' ? 'reg-email-error' : undefined}
                        />
                      </div>
                      {fieldError?.field === 'email' && (
                        <p id="reg-email-error" className="form-error" role="alert">{fieldError.msg}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="emailOrUsername"
                        className="form-label"
                      >
                        {t('email')}
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
                          {t('password')}
                        </label>
                        {!isRegisterMode && (
                          <button
                            type="button"
                            onClick={() => setIsForgotMode(true)}
                            disabled={loading}
                            className="text-xs font-semibold text-[var(--cab-signal)] hover:text-[var(--cab-signal-hover)] transition-colors duration-150 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                            style={{ padding: '2px 4px', minHeight: '28px' }}
                          >
                            {t('forgotPassword')}
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
                          onChange={(e) => { setPassword(e.target.value); if (fieldError?.field === 'password') setFieldError(null) }}
                          required
                          autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                          placeholder={isRegisterMode ? t('placeholderPasswordMin') : t('placeholderPasswordEnter')}
                          className="form-input w-full pl-10 pr-12"
                          aria-invalid={fieldError?.field === 'password' || undefined}
                          aria-describedby={fieldError?.field === 'password' ? 'reg-password-error' : undefined}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {showPassword
                            ? <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
                            : <Eye size={16} strokeWidth={1.5} aria-hidden="true" />}
                        </button>
                      </div>
                      {fieldError?.field === 'password' && (
                        <p id="reg-password-error" className="form-error" role="alert">{fieldError.msg}</p>
                      )}
                    </div>

                    {isRegisterMode && (
                      <div>
                        <label
                          htmlFor="confirmPassword"
                          className="form-label"
                        >
                          {t('repeatPassword')}
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
                            onChange={(e) => { setConfirmPassword(e.target.value); if (fieldError?.field === 'confirm') setFieldError(null) }}
                            required
                            autoComplete="new-password"
                            placeholder={t('placeholderPasswordRepeat')}
                            className="form-input w-full pl-10 pr-12"
                            aria-invalid={fieldError?.field === 'confirm' || undefined}
                            aria-describedby={fieldError?.field === 'confirm' ? 'confirm-password-error' : undefined}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(v => !v)}
                            aria-label={showConfirm ? 'Скрыть подтверждение пароля' : 'Показать подтверждение пароля'}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {showConfirm
                              ? <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
                              : <Eye size={16} strokeWidth={1.5} aria-hidden="true" />}
                          </button>
                        </div>
                        {fieldError?.field === 'confirm' && (
                          <p id="confirm-password-error" className="form-error" role="alert">{fieldError.msg}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="cab-btn cab-btn-primary cab-btn-lg w-full mt-2"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {loading
                    ? (isForgotMode ? t('sending') : isRegisterMode ? t('registering') : t('signingIn'))
                    : (isForgotMode ? t('sendLink') : isRegisterMode ? t('register') : t('signIn'))}
                </button>

                {/* Google OAuth + divider (login mode only) */}
                {!isForgotMode && !isRegisterMode && (
                  <>
                    <div className="flex items-center gap-3 my-5" role="separator" aria-hidden="true">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs font-medium text-gray-400">{t('or')}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      aria-label={t('google')}
                      className="cab-btn cab-btn-secondary cab-btn-lg w-full"
                    >
                      <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                        <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/>
                        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                      </svg>
                      {t('google')}
                    </button>
                  </>
                )}

                {/* Mode switcher */}
                <div className="mt-5 pt-4 text-center border-t border-gray-200">
                  {isForgotMode ? (
                    <button
                      type="button"
                      onClick={() => setIsForgotMode(false)}
                      className="inline-flex items-center justify-center min-h-[44px] px-2 text-sm font-semibold text-[var(--cab-signal)] hover:text-[var(--cab-signal-hover)] transition-colors duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    >
                      {t('backToLogin')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisterMode(!isRegisterMode)
                        setEmail('')
                        setConfirmPassword('')
                      }}
                      className="inline-flex items-center justify-center min-h-[44px] px-2 text-sm font-semibold text-[var(--cab-signal)] hover:text-[var(--cab-signal-hover)] transition-colors duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    >
                      {isRegisterMode ? t('haveAccount') : t('noAccount')}
                    </button>
                  )}
                </div>
              </motion.form>
            </AnimatePresence>

            </div>
            {/* /карточка формы */}

        </div>
      </div>
    </div>
  )
}
