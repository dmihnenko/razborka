import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Car, Lock, Loader2 } from 'lucide-react'
import { PublicBrandHeader } from '@/components/PublicBrandHeader'
import { validateVehicleShareCode } from '@/services/personalVehicles'

export default function VehicleAccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const codeParam = searchParams.get('code')
    if (codeParam) {
      setCode(codeParam)
      handleAccess(codeParam)
    }
  }, [searchParams])

  const handleAccess = async (accessCode: string) => {
    // Новый код — 8 симв. (A–Z/2–9); старые ссылки с 4-значным числовым кодом ещё работают.
    const trimmedCode = accessCode.trim().toUpperCase()

    if (!/^[A-Z0-9]{4,8}$/.test(trimmedCode)) {
      setError('Неверный формат кода')
      return
    }

    setLoading(true)
    setError('')

    try {
      const vehicleId = await validateVehicleShareCode(trimmedCode)

      if (!vehicleId) {
        setError('Код не найден или неактивен')
        setLoading(false)
        return
      }

      navigate(`/public/personal-vehicle/${vehicleId}`)
    } catch (err) {
      console.error('Failed to validate code:', err)
      setError('Ошибка при проверке кода')
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleAccess(code)
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Буквы+цифры, до 8 симв., в верхний регистр (старые числовые коды тоже проходят).
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    setCode(value)
    setError('')
  }

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'var(--cab-bg)', fontFamily: 'var(--font-sans)' }}
    >
      <PublicBrandHeader subtitle="Доступ по коду" />
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          <div className="cab-card overflow-hidden">
            {/* Шапка карточки */}
            <div className="px-8 pt-8 pb-6 text-center border-b border-[var(--cab-border)]">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-[var(--cab-signal-weak)]">
                <Car className="w-8 h-8 text-[var(--cab-signal)]" strokeWidth={1.5} />
              </div>
              <h1
                className="text-gray-900 font-extrabold mb-1.5"
                style={{ fontSize: 'clamp(20px, 4vw, 24px)', letterSpacing: '-0.03em' }}
              >
                Доступ к автомобилю
              </h1>
              <p className="text-sm text-gray-500">Введите код доступа</p>
            </div>

            {/* Форма */}
            <div className="px-8 py-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="access-code" className="form-label text-center">
                    Код доступа
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <input
                      id="access-code"
                      type="text"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoComplete="off"
                      pattern="[A-Za-z0-9]{4,8}"
                      value={code}
                      onChange={handleCodeChange}
                      disabled={loading}
                      className={`w-full rounded-xl bg-white text-gray-900 text-center font-extrabold outline-none transition-all duration-150 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                        error
                          ? 'border-2 border-red-500'
                          : 'border-2 border-[var(--cab-border)] focus-visible:border-[var(--cab-signal)]'
                      }`}
                      style={{
                        paddingLeft: '48px',
                        paddingRight: '16px',
                        paddingTop: '16px',
                        paddingBottom: '16px',
                        fontSize: '28px',
                        letterSpacing: '0.3em',
                      }}
                      placeholder="--------"
                      maxLength={8}
                      required
                      autoFocus
                      aria-invalid={!!error}
                      aria-describedby={error ? 'access-code-error' : undefined}
                    />
                  </div>
                  {error && (
                    <p id="access-code-error" className="mt-2 text-sm text-red-600 text-center" role="alert">
                      {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || code.length < 4}
                  className="cab-btn cab-btn-primary cab-btn-lg w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
                      Проверка…
                    </>
                  ) : (
                    'Получить доступ'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500 mb-2">
                  Код можно получить у владельца автомобиля
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                  <span>• Код или ссылка</span>
                  <span>• Безопасно</span>
                  <span>• Только для чтения</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
