import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getDefaultRouteForRoles } from '../config/navigation'

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают')
      return
    }
    
    setLoading(true)

    let email = emailOrUsername
    let username = emailOrUsername

    // Если введен email, генерируем username
    if (emailOrUsername.includes('@')) {
      email = emailOrUsername
      username = emailOrUsername.split('@')[0]
    } else {
      // Если введен username, генерируем email
      username = emailOrUsername
      email = `${emailOrUsername}@example.com`
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
          plain_password: password
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
      // Это username, генерируем email по паттерну username@example.com
      loginEmail = `${emailOrUsername}@example.com`
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

      // Определяем куда направить пользователя на основе основной роли
      const defaultRoute = primaryRoleName 
        ? getDefaultRouteForRoles([primaryRoleName])
        : getDefaultRouteForRoles(roleNames)
      
      navigate(defaultRoute)
    }

    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="mb-6 text-2xl font-bold text-center text-gray-900">
          {isRegisterMode ? 'Регистрация' : 'CRM'}
        </h2>
        <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-4">
          <div>
            <label htmlFor="emailOrUsername" className="block text-sm font-medium text-gray-700">
              Email или Логин
            </label>
            <input
              id="emailOrUsername"
              type="text"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              required
              autoComplete="username"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="email@example.com или username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isRegisterMode ? "new-password" : "current-password"}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              placeholder={isRegisterMode ? "Минимум 6 символов" : ""}
            />
          </div>
          {isRegisterMode && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Подтверждение пароля
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="Повторите пароль"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
          >
            {loading ? (isRegisterMode ? 'Регистрация...' : 'Вход...') : (isRegisterMode ? 'Зарегистрироваться' : 'Войти')}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsRegisterMode(!isRegisterMode)
              setConfirmPassword('')
            }}
            className="text-sm text-primary hover:underline"
          >
            {isRegisterMode ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>
        </div>
      </div>
    </div>
  )
}
