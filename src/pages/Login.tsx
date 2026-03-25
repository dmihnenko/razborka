import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { getDefaultRouteForRoles } from '../config/navigation'
import { Wrench } from 'lucide-react'

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают')
      return
    }

    // Валидация username
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!usernameRegex.test(username)) {
      toast.error('Username должен содержать 3-20 символов (латиница, цифры, подчёркивание)')
      return
    }
    
    setLoading(true)

    // Проверяем уникальность username
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      toast.error('Этот username уже занят')
      setLoading(false)
      return
    }

    // Генерируем email для Supabase (если не введен реальный)
    const authEmail = email.trim() || `${username.toLowerCase()}@internal.local`
    const realEmail = email.trim() || null

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          username: username.toLowerCase(),
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
      toast.success('Регистрация успешна! Войдите в систему')
      setIsRegisterMode(false)
      setUsername('')
      setEmail('')
      setConfirmPassword('')
    }

    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    let loginEmail = emailOrUsername

    // Проверяем, это email или username
    if (!emailOrUsername.includes('@')) {
      // Это username, ищем пользователя в базе
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', emailOrUsername.toLowerCase())
        .maybeSingle()

      if (profile) {
        // Пробуем новый формат email
        loginEmail = `${emailOrUsername.toLowerCase()}@internal.local`
        
        // Если не получится, попробуем старый формат
        const { error: newFormatError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        })
        
        if (newFormatError) {
          // Пробуем старый формат
          loginEmail = `${emailOrUsername}@example.com`
        } else {
          // Успешный вход с новым форматом
          await handleSuccessfulLogin()
          setLoading(false)
          return
        }
      } else {
        // Если не нашли в новом формате, пробуем старый
        loginEmail = `${emailOrUsername}@example.com`
      }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      toast.error('Ошибка входа: ' + error.message)
      setLoading(false)
      return
    }

    await handleSuccessfulLogin()
    setLoading(false)
  }

  const handleSuccessfulLogin = async () => {
    // Получаем профиль пользователя для определения ролей
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Получаем все роли пользователя с информацией об основной роли
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('role_id, is_primary')
        .eq('user_id', user.id)

      let primaryRoleName: string | null = null
      let roleNames: string[] = []

      if (userRolesData && userRolesData.length > 0) {
        const roleIds = userRolesData.map(ur => ur.role_id)
        const { data: rolesData } = await supabase
          .from('roles')
          .select('id, name')
          .in('id', roleIds)

        roleNames = rolesData?.map(r => r.name) || []
        
        // Находим основную роль
        const primaryRoleId = userRolesData.find(ur => ur.is_primary)?.role_id
        if (primaryRoleId) {
          primaryRoleName = rolesData?.find(r => r.id === primaryRoleId)?.name || null
        }
      }

      // КРИТИЧНО: Инвалидируем кэш профиля
      await queryClient.invalidateQueries({ queryKey: ['userProfile'] })

      // Определяем куда направить пользователя на основе основной роли
      const defaultRoute = primaryRoleName 
        ? getDefaultRouteForRoles([primaryRoleName])
        : getDefaultRouteForRoles(roleNames)
      
      navigate(defaultRoute)
    }
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
        .input-dark {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: #F1F5F9;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 100%;
        }
        .input-dark::placeholder { color: #374151; }
        .input-dark:focus {
          outline: none;
          border-color: #3B82F6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
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

      <div className="login-root flex min-h-screen" style={{ background: '#080C14' }}>

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
            <p style={{ color:'#4B5563', fontSize:'15px', maxWidth:'300px', lineHeight:'1.7' }}>
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
                <div style={{ color:'#374151', fontSize:'11px', marginTop:'1px' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Right form panel ─────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center p-6" style={{ background:'#0D1117' }}>
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
                {isRegisterMode ? 'Создать аккаунт' : 'Добро пожаловать'}
              </h2>
              <p style={{ color:'#4B5563', fontSize:'13px', marginBottom:'28px' }}>
                {isRegisterMode ? 'Заполните данные для регистрации' : 'Войдите в свой аккаунт'}
              </p>
            </div>

            <form onSubmit={isRegisterMode ? handleRegister : handleLogin}>

              <div className="fu fu-2" style={{ marginBottom:'16px' }}>
                {isRegisterMode ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div>
                      <label style={{ color:'#9CA3AF', fontSize:'12px', fontWeight:'500', display:'block', marginBottom:'6px', letterSpacing:'0.3px' }}>USERNAME *</label>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                        className="input-dark px-4 py-3 rounded-lg text-sm"
                        placeholder="username (латиница, цифры, _)"
                        pattern="[a-zA-Z0-9_]{3,20}"
                      />
                      <p style={{ color:'#374151', fontSize:'11px', marginTop:'4px' }}>3-20 символов: латиница, цифры, _</p>
                    </div>
                    <div>
                      <label style={{ color:'#9CA3AF', fontSize:'12px', fontWeight:'500', display:'block', marginBottom:'6px', letterSpacing:'0.3px' }}>
                        EMAIL <span style={{ color:'#374151', fontWeight:'400' }}>(необязательно)</span>
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        className="input-dark px-4 py-3 rounded-lg text-sm"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ color:'#9CA3AF', fontSize:'12px', fontWeight:'500', display:'block', marginBottom:'6px', letterSpacing:'0.3px' }}>EMAIL ИЛИ USERNAME</label>
                    <input
                      id="emailOrUsername"
                      type="text"
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      required
                      autoComplete="username"
                      className="input-dark px-4 py-3 rounded-lg text-sm"
                      placeholder="email@example.com или username"
                    />
                  </div>
                )}
              </div>

              <div className="fu fu-3" style={{ display:'flex', flexDirection:'column', gap:'14px', marginBottom:'24px' }}>
                <div>
                  <label style={{ color:'#9CA3AF', fontSize:'12px', fontWeight:'500', display:'block', marginBottom:'6px', letterSpacing:'0.3px' }}>ПАРОЛЬ</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                    className="input-dark px-4 py-3 rounded-lg text-sm"
                    placeholder={isRegisterMode ? 'Минимум 6 символов' : ''}
                  />
                </div>
                {isRegisterMode && (
                  <div>
                    <label style={{ color:'#9CA3AF', fontSize:'12px', fontWeight:'500', display:'block', marginBottom:'6px', letterSpacing:'0.3px' }}>ПОДТВЕРЖДЕНИЕ ПАРОЛЯ</label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="input-dark px-4 py-3 rounded-lg text-sm"
                      placeholder="Повторите пароль"
                    />
                  </div>
                )}
              </div>

              <div className="fu fu-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ letterSpacing:'0.4px' }}
                >
                  {loading
                    ? (isRegisterMode ? 'Регистрация...' : 'Вход...')
                    : (isRegisterMode ? 'Зарегистрироваться' : 'Войти')}
                </button>

                <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', marginTop:'20px', paddingTop:'16px', textAlign:'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(!isRegisterMode)
                      setUsername('')
                      setEmail('')
                      setConfirmPassword('')
                    }}
                    style={{ color:'#3B82F6', fontSize:'13px', background:'none', border:'none', cursor:'pointer', transition:'color 0.15s' }}
                    onMouseOver={e => (e.currentTarget.style.color = '#60A5FA')}
                    onMouseOut={e => (e.currentTarget.style.color = '#3B82F6')}
                  >
                    {isRegisterMode ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      </div>
    </>
  )
}
