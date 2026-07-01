import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

/**
 * Страница установки нового пароля после перехода по ссылке из письма
 * восстановления. Supabase при загрузке распознаёт recovery-токен из URL
 * и создаёт временную сессию; здесь пользователь задаёт новый пароль.
 */
export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  // Инлайн-ошибка, привязанная к полю (a11y: aria-invalid + role="alert"), в дополнение к тосту.
  const [fieldError, setFieldError] = useState<{ field: 'password' | 'confirm'; msg: string } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Ждём, пока supabase-js обработает recovery-токен из URL.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true)
        if (session?.user?.email) setEmail(session.user.email)
      }
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
        if (data.session.user?.email) setEmail(data.session.user.email)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError(null)
    if (password.length < 6) {
      const msg = 'Пароль должен содержать минимум 6 символов'
      setFieldError({ field: 'password', msg })
      toast.error(msg)
      return
    }
    if (password !== confirm) {
      const msg = 'Пароли не совпадают'
      setFieldError({ field: 'confirm', msg })
      toast.error(msg)
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast.error('Не удалось обновить пароль: ' + error.message)
      return
    }
    toast.success('Пароль обновлён. Войдите с новым паролем.')
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div
      className="flex min-h-dvh"
      style={{
        fontFamily: 'var(--font-sans)',
        background: 'var(--cab-bg)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ minWidth: 0 }}>
        <div
          className="m-auto w-full"
          style={{
            maxWidth: '400px',
            padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 40px)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center justify-center mb-4">
            <Logo size="sm" withText />
          </div>

          {/* Карточка формы — единый стиль Ink & Signal */}
          <div className="cab-card p-5 sm:p-6">
            <div className="mb-6 text-center">
              <h1
                className="text-gray-900 font-extrabold mb-1.5"
                style={{ fontSize: 'clamp(20px, 4vw, 24px)', letterSpacing: '-0.03em' }}
              >
                Новый пароль
              </h1>
              <p className="text-sm leading-relaxed text-gray-500">
                Придумайте новый пароль для входа в систему
              </p>
              {email && (
                <p className="mt-2 text-sm font-semibold text-gray-900 break-all">
                  {email}
                </p>
              )}
            </div>

            {!ready ? (
              <p className="text-sm leading-relaxed text-gray-500 text-center">
                Проверяем ссылку из письма… Если страница не загружается, откройте ссылку из письма заново.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                {/* Новый пароль */}
                <div>
                  <label htmlFor="new-password" className="form-label">
                    Новый пароль
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      strokeWidth={1.5}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
                      aria-hidden="true"
                    />
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (fieldError) setFieldError(null) }}
                      required
                      placeholder="Минимум 6 символов"
                      className="form-input w-full pl-10 pr-12"
                      autoComplete="new-password"
                      aria-invalid={fieldError?.field === 'password' || undefined}
                      aria-describedby={fieldError?.field === 'password' ? 'new-password-error' : undefined}
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
                    <p id="new-password-error" className="form-error" role="alert">{fieldError.msg}</p>
                  )}
                </div>

                {/* Повтор пароля */}
                <div>
                  <label htmlFor="confirm-password" className="form-label">
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
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); if (fieldError) setFieldError(null) }}
                      required
                      placeholder="Повторите пароль"
                      className="form-input w-full pl-10 pr-12"
                      autoComplete="new-password"
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

                <button
                  type="submit"
                  disabled={loading}
                  className="cab-btn cab-btn-primary cab-btn-lg w-full mt-2"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {loading ? 'Сохранение…' : 'Сохранить пароль'}
                </button>

                <div className="mt-1 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="inline-flex items-center justify-center min-h-[44px] px-2 text-sm font-semibold text-[var(--cab-signal)] hover:text-[var(--cab-signal-hover)] transition-colors duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  >
                    Вернуться ко входу
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
