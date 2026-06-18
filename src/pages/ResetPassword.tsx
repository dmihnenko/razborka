import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND } from '@/config/brand'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Wrench, Lock, Eye, EyeOff } from 'lucide-react'

/**
 * Страница установки нового пароля после перехода по ссылке из письма
 * восстановления. Supabase при загрузке распознаёт recovery-токен из URL
 * и создаёт временную сессию; здесь пользователь задаёт новый пароль.
 */
export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
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
    if (password.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов')
      return
    }
    if (password !== confirm) {
      toast.error('Пароли не совпадают')
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
    <div className="login-root flex min-h-dvh items-center justify-center px-4" style={{ background: '#0D1117' }}>
      <style>{`.login-root{font-family:'DM Sans',system-ui,sans-serif}.brand-font{font-family:'Bebas Neue',sans-serif}
        .input-dark{background:rgba(255,255,255,0.07);border:1px solid rgba(148,163,184,0.22);color:#F1F5F9;width:100%;height:48px;padding-left:44px}
        .input-dark::placeholder{color:#64748B}.input-dark:focus{outline:none;border-color:#4D51D4;box-shadow:0 0 0 3px rgba(59,130,246,0.18)}`}</style>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div className="flex items-center justify-center gap-2 mb-8">
          <div style={{ width: '36px', height: '36px', background: '#3538CD', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wrench size={18} color="white" />
          </div>
          <span className="brand-font text-white" style={{ fontSize: '22px', letterSpacing: '3px' }}>{BRAND.name}</span>
        </div>

        <h2 style={{ color: '#F1F5F9', fontSize: '22px', fontWeight: 600, marginBottom: '4px', textAlign: 'center' }}>Новый пароль</h2>
        <p style={{ color: '#94A3B8', fontSize: '13px', marginBottom: email ? '8px' : '24px', textAlign: 'center' }}>
          Придумайте новый пароль для входа в систему
        </p>
        {email && (
          <p style={{ color: '#F1F5F9', fontSize: '14px', fontWeight: 600, marginBottom: '24px', textAlign: 'center', wordBreak: 'break-all' }}>
            {email}
          </p>
        )}

        {!ready ? (
          <p style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center' }}>
            Проверяем ссылку из письма… Если страница не загружается, откройте ссылку из письма заново.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="field" style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Новый пароль (мин. 6)"
                className="input-dark rounded-lg text-sm"
                style={{ paddingRight: '44px' }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="field" style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Повторите пароль"
                className="input-dark rounded-lg text-sm"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#3538CD 0%,#2A2DA8 100%)', letterSpacing: '0.4px' }}
            >
              {loading ? 'Сохранение…' : 'Сохранить пароль'}
            </button>
            <button type="button" onClick={() => navigate('/login')}
              style={{ color: '#4D51D4', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}>
              Вернуться ко входу
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
