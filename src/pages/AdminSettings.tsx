import { Settings as SettingsIcon, Palette, Check, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function AdminSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <SettingsIcon className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Настройки</h1>
          <p className="text-sm text-gray-500">Параметры администратора</p>
        </div>
      </div>

      {/* ─── Theme Selector ─────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Palette className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Оформление интерфейса</h2>
            <p className="text-xs text-gray-500 mt-0.5">Выберите цветовую схему системы</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Light theme card */}
          <button
            onClick={() => setTheme('light')}
            className={`relative group rounded-xl border-2 p-1 transition-all overflow-hidden ${
              theme === 'light'
                ? 'border-blue-500 shadow-md shadow-blue-500/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="rounded-lg overflow-hidden bg-gray-50 aspect-video relative">
              <div className="absolute left-0 top-0 bottom-0 w-[28%] bg-white border-r border-gray-200 flex flex-col gap-1 p-1.5">
                <div className="w-4 h-4 rounded bg-purple-500 mb-1" />
                {[80,60,70,55,65].map((w, i) => (
                  <div key={i} className="h-1.5 rounded-full bg-gray-200" style={{ width: `${w}%`, opacity: i === 1 ? 1 : 0.5 }} />
                ))}
              </div>
              <div className="absolute left-[30%] right-0 top-0 p-1.5 flex flex-col gap-1">
                <div className="h-2 w-12 bg-gray-900 rounded mb-1" />
                <div className="grid grid-cols-2 gap-1">
                  {['bg-blue-100','bg-green-100','bg-orange-100','bg-purple-100'].map(c => (
                    <div key={c} className={`h-4 rounded-lg ${c} border border-gray-200`} />
                  ))}
                </div>
                <div className="h-6 rounded-lg bg-white border border-gray-200 mt-1" />
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-xs font-semibold text-gray-700">Светлая</span>
              </div>
              {theme === 'light' && (
                <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                  <Check className="w-3 h-3" /> Активна
                </span>
              )}
            </div>
          </button>

          {/* Dark theme card */}
          <button
            onClick={() => setTheme('dark')}
            className={`relative group rounded-xl border-2 p-1 transition-all overflow-hidden ${
              theme === 'dark'
                ? 'border-blue-500 shadow-md shadow-blue-500/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="rounded-lg overflow-hidden aspect-video relative" style={{ background: '#080C14' }}>
              <div className="absolute left-0 top-0 bottom-0 w-[28%] flex flex-col gap-1 p-1.5" style={{ background: '#0F1729', borderRight: '1px solid #1E2A3B' }}>
                <div className="w-4 h-4 rounded bg-purple-500 mb-1" />
                {[80,60,70,55,65].map((w, i) => (
                  <div key={i} className="h-1.5 rounded-full" style={{ width: `${w}%`, background: i === 1 ? '#7C3AED' : '#1E2A3B', opacity: i === 1 ? 1 : 0.7 }} />
                ))}
              </div>
              <div className="absolute left-[30%] right-0 top-0 p-1.5 flex flex-col gap-1">
                <div className="h-2 w-12 rounded mb-1" style={{ background: '#F1F5F9' }} />
                <div className="grid grid-cols-2 gap-1">
                  {['rgba(37,99,235,0.2)','rgba(22,163,74,0.2)','rgba(234,88,12,0.2)','rgba(124,58,237,0.2)'].map((c, i) => (
                    <div key={i} className="h-4 rounded-lg" style={{ background: c, border: '1px solid rgba(255,255,255,0.06)' }} />
                  ))}
                </div>
                <div className="h-6 rounded-lg mt-1" style={{ background: '#161B27', border: '1px solid rgba(255,255,255,0.07)' }} />
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-semibold text-gray-700">Тёмная</span>
              </div>
              {theme === 'dark' && (
                <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                  <Check className="w-3 h-3" /> Активна
                </span>
              )}
            </div>
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-400">
          Выбор сохраняется в браузере и применяется мгновенно.
        </p>
      </div>
    </div>
  )
}
