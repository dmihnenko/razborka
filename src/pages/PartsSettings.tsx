import { useState } from 'react'
import { ArrowLeft, RefreshCw, Save, DollarSign, AlertTriangle, CheckCircle, Key, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getImgbbKey, setImgbbKey } from '@/utils/imgbbKey'
import { toast } from 'sonner'

export default function PartsSettings() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const {
    rate,
    date,
    source,
    isStale,
    fetching,
    fetchError,
    fetchPrivatBank,
    setManualRate,
  } = usePartsExchangeRate()

  const [manualInput, setManualInput] = useState<string>(String(rate))
  const [imgbbKeyInput, setImgbbKeyInput] = useState<string>(getImgbbKey)

  const handleSaveImgbbKey = () => {
    const trimmed = imgbbKeyInput.trim()
    setImgbbKey(trimmed)
    toast.success(trimmed ? 'API ключ ImgBB сохранён' : 'API ключ удалён')
  }

  const handleFetchPrivatBank = async () => {
    try {
      const fetched = await fetchPrivatBank()
      setManualInput(String(fetched))
      toast.success(`Курс ПриватБанка получен: ${fetched} ₴/$`)
    } catch {
      toast.error(fetchError || 'Не удалось получить курс')
    }
  }

  const handleSaveManual = () => {
    const val = parseFloat(manualInput.replace(',', '.'))
    if (!val || val <= 0) {
      toast.error('Введите корректный курс')
      return
    }
    setManualRate(val)
    toast.success(`Курс установлен: ${val} ₴/$`)
  }

  const formatDate = (d: string | null) => {
    if (!d) return null
    const [y, m, day] = d.split('-')
    return `${day}.${m}.${y}`
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-600">У вас нет доступа к разборке</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-16">
            <button
              onClick={() => navigate('/parts/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Настройки разборки</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Курс доллара */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Курс доллара по умолчанию</h2>
              <p className="text-xs text-gray-500">
                Используется для расчёта доходности при продаже запчастей в гривне
              </p>
            </div>
          </div>

          {/* Текущий курс */}
          <div className={`mb-4 p-3 rounded-lg border flex items-start gap-2 ${
            isStale
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}>
            {isStale ? (
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                Текущий курс: <span className="text-lg font-bold">{rate} ₴/$</span>
              </p>
              {date && (
                <p className="text-xs text-gray-500">
                  {isStale
                    ? `Установлен ${formatDate(date)} (вчерашний курс — используется до обновления)`
                    : `Установлен сегодня ${formatDate(date)} · ${source === 'privatbank' ? 'ПриватБанк' : 'вручную'}`
                  }
                </p>
              )}
              {!date && (
                <p className="text-xs text-gray-500">Курс по умолчанию — обновите для точных расчётов</p>
              )}
            </div>
          </div>

          {/* Получить от ПриватБанка */}
          <div className="mb-4">
            <button
              onClick={handleFetchPrivatBank}
              disabled={fetching}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
              {fetching ? 'Получаем курс...' : 'Получить официальный курс ПриватБанка'}
            </button>
            {fetchError && (
              <p className="text-xs text-red-600 mt-1">{fetchError}</p>
            )}
            <p className="text-xs text-gray-400 mt-1 text-center">
              Курс продажи USD/UAH на сегодня
            </p>
          </div>

          {/* Разделитель */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">или установить вручную</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Ручная установка */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="number"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                min="1"
                step="0.01"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
                placeholder="41.50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₴/$</span>
            </div>
            <button
              onClick={handleSaveManual}
              className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
          </div>
        </div>

        {/* Подсказка */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          <p className="font-medium mb-1">Как работает курс:</p>
          <ul className="space-y-1 list-disc list-inside text-xs text-blue-600">
            <li>Если запчасть продана в гривне — доход в $ считается по этому курсу</li>
            <li>Каждый автомобиль может иметь свой курс (указывается при редактировании авто)</li>
            <li>Если курс не обновлялся сегодня — используется последний установленный</li>
          </ul>
        </div>

        {/* ImgBB API ключ */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Key className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">ImgBB API ключ</h2>
              <p className="text-xs text-gray-500">
                Нужен для хранения фотографий запчастей
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={imgbbKeyInput}
                onChange={e => setImgbbKeyInput(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                placeholder="Вставьте ключ API..."
              />
              <button
                onClick={handleSaveImgbbKey}
                className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
            {imgbbKeyInput && (
              <p className="text-xs text-green-600 mt-1">✓ Ключ установлен</p>
            )}
          </div>

          <a
            href="https://api.imgbb.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Получить бесплатный ключ на imgbb.com
          </a>
        </div>

      </div>
    </div>
  )
}
