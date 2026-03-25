import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Car, Lock } from 'lucide-react'
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
    const trimmedCode = accessCode.trim()

    if (!/^\d{4}$/.test(trimmedCode)) {
      setError('Код должен состоять из 4 цифр')
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
    const value = e.target.value.replace(/\D/g, '').slice(0, 4)
    setCode(value)
    setError('')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <PublicBrandHeader subtitle="Доступ по коду" />
      <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div style={{ background: '#161B27', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e3063 100%)', padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', marginBottom: '16px' }}>
              <Car style={{ width: '36px', height: '36px', color: '#93C5FD' }} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#F1F5F9', marginBottom: '6px' }}>Доступ к автомобилю</h1>
            <p style={{ color: '#93C5FD', fontSize: '14px' }}>Введите 4-значный код доступа</p>
          </div>

          {/* Форма */}
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#9CA3AF', marginBottom: '8px', textAlign: 'center', letterSpacing: '0.3px' }}>
                  КОД ДОСТУПА
                </label>
                <div className="relative">
                  <Lock style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#4B5563' }} />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4}"
                    value={code}
                    onChange={handleCodeChange}
                    style={{
                      width: '100%',
                      paddingLeft: '48px',
                      paddingRight: '16px',
                      paddingTop: '16px',
                      paddingBottom: '16px',
                      textAlign: 'center',
                      fontSize: '32px',
                      fontWeight: '700',
                      letterSpacing: '0.4em',
                      background: 'rgba(255,255,255,0.04)',
                      border: `2px solid ${error ? '#EF4444' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '10px',
                      color: '#F1F5F9',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = error ? '#EF4444' : '#3B82F6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = error ? '#EF4444' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                    placeholder="0000"
                    maxLength={4}
                    required
                    autoFocus
                  />
                </div>
                {error && (
                  <p style={{ marginTop: '8px', fontSize: '13px', color: '#F87171', textAlign: 'center' }}>
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 4}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: loading || code.length !== 4 ? 'not-allowed' : 'pointer',
                  opacity: loading || code.length !== 4 ? 0.5 : 1,
                  transition: 'opacity 0.2s, transform 0.15s',
                }}
                onMouseOver={e => { if (!loading && code.length === 4) e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseOut={e => { e.currentTarget.style.transform = 'none' }}
              >
                {loading ? 'Проверка...' : 'Получить доступ'}
              </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#4B5563', marginBottom: '8px' }}>
                Код можно получить у владельца автомобиля
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', fontSize: '11px', color: '#374151' }}>
                <span>• 4 цифры</span>
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
