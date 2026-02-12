import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Car, Lock } from 'lucide-react'
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Заголовок */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4">
              <Car className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Доступ к автомобилю
            </h1>
            <p className="text-blue-100">
              Введите 4-значный код доступа
            </p>
          </div>

          {/* Форма */}
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Код доступа
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4}"
                    value={code}
                    onChange={handleCodeChange}
                    className={`w-full pl-12 pr-4 py-4 text-center text-3xl font-bold tracking-widest border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      error
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                    }`}
                    placeholder="0000"
                    maxLength={4}
                    required
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="mt-2 text-sm text-red-600 text-center">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 4}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              >
                {loading ? 'Проверка...' : 'Получить доступ'}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500 mb-2">
                Код можно получить у владельца автомобиля
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span>• 4 цифры</span>
                <span>• Безопасно</span>
                <span>• Только для чтения</span>
              </div>
            </div>
          </div>
        </div>

        {/* Информационный блок */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Введя код, вы получите доступ к детальной информации<br />
            об автомобиле, включая расходы и фотогалерею
          </p>
        </div>
      </div>
    </div>
  )
}
