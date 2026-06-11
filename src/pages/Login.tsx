import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUserRolesWithNames, getEmailByUsername } from '@/services/userService'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { getDefaultRouteForRoles } from '../config/navigation'
import { Wrench, Mail, Lock, AtSign, Eye, EyeOff } from 'lucide-react'

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

  const labelStyle: React.CSSProperties = {
    color: '#94A3B8',
    fontSize: '13px',
    fontWeight: 500,
    display: 'block',
    marginBottom: '7px',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        .login-root { font-family: 'DM Sans', system-ui, sans-serif; }
        .brand-font { font-family: 'Bebas Neue', sans-serif; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(59,130,246,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.07) 1px, transparent 1px);
          background-size: 44px 44px;
        }
        .field { position: relative; }
        .field-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748B;
          pointer-events: none;
          transition: color 0.2s;
        }
        .input-dark {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(148,163,184,0.22);
          color: #F1F5F9;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          width: 100%;
          height: 48px;
          padding-left: 44px;
        }
        .input-dark::placeholder { color: #64748B; }
        .input-dark:hover { border-color: rgba(148,163,184,0.35); }
        .input-dark:focus {
          outline: none;
          background: rgba(255,255,255,0.09);
          border-color: #3B82F6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.18);
        }
        .field:focus-within .field-icon { color: #3B82F6; }
        .input-trail {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748B;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          border-radius: 8px;
          transition: color 0.2s, background 0.2s;
        }
        .input-trail:hover { color: #94A3B8; background: rgba(255,255,255,0.05); }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fu { animation: fadeUp 0.5s ease forwards; opacity: 0; }
        .fu-1 { animation-delay: 0.05s; }
        .fu-2 { animation-delay: 0.15s; }
        .fu-3 { animation-delay: 0.25s; }
        .fu-4 { animation-delay: 0.35s; }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .btn-primary {
          background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
          transition: opacity 0.2s, transform 0.15s;
        }
        .btn-primary:not(:disabled):hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:not(:disabled):active { transform: translateY(0); }
      `}</style>

      <div className="login-root flex min-h-dvh" style={{ background: '#080C14' }}>

        {/* ─── Left brand panel ─────────────────────────────── */}
        <div
          className="hidden lg:flex lg:w-1/2 grid-bg relative flex-col justify-between p-12 overflow-hidden"
          style={{ borderRight: '1px solid rgba(59,130,246,0.12)' }}
        >
          {/* Glow orbs */}
          <div style={{ position:'absolute', top:'-120px', right:'-120px', width:'480px', height:'480px', borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:'-80px', left:'-80px', width:'320px', height:'320px', borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 65%)', pointerEvents:'none' }} />

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div style={{ width:'42px', height:'42px', background:'#2563EB', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Wrench size={22} color="white" />
            </div>
            <span className="brand-font text-white" style={{ fontSize:'26px', letterSpacing:'3px' }}>TSP CRM</span>
          </div>

          {/* Hero text */}
          <div>
            <h1 className="brand-font text-white" style={{ fontSize:'80px', lineHeight:'0.92', letterSpacing:'1px', marginBottom:'24px' }}>
              АВТО<br />
              <span style={{ color:'#3B82F6' }}>БИЗНЕС</span><br />
              ПОД<br />
              КОНТРОЛЕМ
            </h1>
            <p style={{ color:'#94A3B8', fontSize:'15px', maxWidth:'300px', lineHeight:'1.7' }}>
              Система управления для СТО и авторазборок.
              Клиенты, автомобили, заявки — всё в одном месте.
            </p>
          </div>

          {/* Feature chips */}
          <div className="flex flex-wrap gap-3">
            {[
              { label:'СТО', sub:'заявки и наряды' },
              { label:'Разборка', sub:'складской учёт' },
              { label:'Клиенты', sub:'история авто' },
            ].map(({ label, sub }) => (
              <div key={label} style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.18)', borderRadius:'8px', padding:'8px 14px' }}>
                <div style={{ color:'#60A5FA', fontWeight:'600', fontSize:'12px', letterSpacing:'0.5px' }}>{label}</div>
                <div style={{ color:'#7AA3C8', fontSize:'11px', marginTop:'1px' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Right form panel ─────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center" style={{ background:'#0D1117', padding:'clamp(16px, 4vw, 40px) 16px' }}>
          <div style={{ width:'100%', maxWidth:'360px' }}>

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
              <div style={{ width:'36px', height:'36px', background:'#2563EB', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Wrench size={18} color="white" />
              </div>
              <span className="brand-font text-white" style={{ fontSize:'22px', letterSpacing:'3px' }}>TSP CRM</span>
            </div>

            <div className="fu fu-1">
              <h2 style={{ color:'#F1F5F9', fontSize:'22px', fontWeight:'600', marginBottom:'4px' }}>
                {isForgotMode ? 'Восстановление пароля' : isRegisterMode ? 'Создать аккаунт' : 'Добро пожаловать'}
              </h2>
              <p style={{ color:'#94A3B8', fontSize:'13px', marginBottom:'28px' }}>
                {isForgotMode
                  ? 'Введите email — отправим ссылку для сброса пароля'
                  : isRegisterMode ? 'Заполните данные для регистрации' : 'Войдите в свой аккаунт'}
              </p>
            </div>

            <form onSubmit={isForgotMode ? handleForgotPassword : isRegisterMode ? handleRegister : handleLogin}>

              <div className="fu fu-2" style={{ display:'flex', flexDirection:'column', gap:'16px', marginBottom:'16px' }}>
                {isRegisterMode ? (
                  <div>
                    <label htmlFor="email" style={labelStyle}>Email</label>
                    <div className="field">
                      <Mail size={18} className="field-icon" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        className="input-dark rounded-lg text-sm"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="emailOrUsername" style={labelStyle}>Email</label>
                    <div className="field">
                      <AtSign size={18} className="field-icon" />
                      <input
                        id="emailOrUsername"
                        type="email"
                        value={emailOrUsername}
                        onChange={(e) => setEmailOrUsername(e.target.value)}
                        required
                        autoComplete="email"
                        className="input-dark rounded-lg text-sm"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!isForgotMode && (
              <div className="fu fu-3" style={{ display:'flex', flexDirection:'column', gap:'16px', marginBottom:'24px' }}>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                    <label htmlFor="password" style={labelStyle}>Пароль</label>
                    {!isRegisterMode && (
                      <button
                        type="button"
                        onClick={() => setIsForgotMode(true)}
                        disabled={loading}
                        style={{ color:'#3B82F6', fontSize:'12px', background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:'7px' }}
                      >
                        Забыли пароль?
                      </button>
                    )}
                  </div>
                  <div className="field">
                    <Lock size={18} className="field-icon" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                      className="input-dark rounded-lg text-sm"
                      style={{ paddingRight: '44px' }}
                      placeholder={isRegisterMode ? 'Минимум 6 символов' : 'Введите пароль'}
                    />
                    <button type="button" className="input-trail" onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label="Показать пароль">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                {isRegisterMode && (
                  <div>
                    <label htmlFor="confirmPassword" style={labelStyle}>Повторите пароль</label>
                    <div className="field">
                      <Lock size={18} className="field-icon" />
                      <input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="input-dark rounded-lg text-sm"
                        style={{ paddingRight: '44px' }}
                        placeholder="Ещё раз тот же пароль"
                      />
                      <button type="button" className="input-trail" onClick={() => setShowConfirm(v => !v)} tabIndex={-1} aria-label="Показать пароль">
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}

              <div className="fu fu-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ letterSpacing:'0.4px' }}
                >
                  {loading
                    ? (isForgotMode ? 'Отправка...' : isRegisterMode ? 'Регистрация...' : 'Вход...')
                    : (isForgotMode ? 'Отправить ссылку' : isRegisterMode ? 'Зарегистрироваться' : 'Войти')}
                </button>

                {!isForgotMode && !isRegisterMode && (
                  <>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'18px 0' }}>
                      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.08)' }} />
                      <span style={{ color:'#64748B', fontSize:'12px' }}>или</span>
                      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.08)' }} />
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', background:'#FFFFFF', color:'#1F2937', transition:'opacity 0.2s' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                        <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/>
                        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                      </svg>
                      Войти через Google
                    </button>
                  </>
                )}

                <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', marginTop:'20px', paddingTop:'16px', textAlign:'center' }}>
                  {isForgotMode ? (
                    <button
                      type="button"
                      onClick={() => setIsForgotMode(false)}
                      style={{ color:'#3B82F6', fontSize:'13px', background:'none', border:'none', cursor:'pointer', transition:'color 0.15s' }}
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
                      style={{ color:'#3B82F6', fontSize:'13px', background:'none', border:'none', cursor:'pointer', transition:'color 0.15s' }}
                      onMouseOver={e => (e.currentTarget.style.color = '#60A5FA')}
                      onMouseOut={e => (e.currentTarget.style.color = '#3B82F6')}
                    >
                      {isRegisterMode ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                    </button>
                  )}
                </div>
              </div>

            </form>
          </div>
        </div>
      </div>
    </>
  )
}
