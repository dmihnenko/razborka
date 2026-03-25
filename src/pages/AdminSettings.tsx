import { Settings as SettingsIcon, Layers, Check, Loader2, Zap, Globe } from 'lucide-react'
import { useDesignSystem } from '@/hooks/useDesignSystem'
import { toast } from 'sonner'

export default function AdminSettings() {
  const { design, setDesign, loading } = useDesignSystem()

  const handleSelect = async (next: 'classic' | 'new') => {
    if (next === design) return
    try {
      await setDesign(next)
      toast.success(`Дизайн «${next === 'classic' ? 'Классика' : 'Precision Pro'}» применён для всех пользователей`)
    } catch {
      toast.error('Ошибка при смене дизайна')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <SettingsIcon className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Настройки платформы</h1>
          <p className="text-sm text-gray-500">Глобальные параметры для всех пользователей</p>
        </div>
      </div>

      {/* ─── Design System Selector ──────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
        {/* Section heading */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Layers className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Дизайн-система</h2>
              <p className="text-xs text-gray-500 mt-0.5">Выбор применяется мгновенно для всех пользователей</p>
            </div>
          </div>
          {loading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
        </div>

        {/* Global broadcast notice */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
          <Globe className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            Смена дизайна применяется глобально — все подключённые пользователи увидят изменения в реальном времени.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ── Classic Design Card ─────────────────────── */}
          <button
            onClick={() => handleSelect('classic')}
            disabled={loading}
            className={`group relative rounded-xl border-2 p-1.5 transition-all duration-200 text-left ${
              design === 'classic'
                ? 'border-purple-500 shadow-lg shadow-purple-500/15'
                : 'border-gray-200 hover:border-purple-300 hover:shadow-sm'
            }`}
          >
            {/* Preview mockup */}
            <div className="rounded-lg overflow-hidden aspect-[16/9] relative" style={{ background: '#F9FAFB' }}>
              {/* Sidebar */}
              <div className="absolute left-0 top-0 bottom-0 w-[26%] flex flex-col gap-1 p-2" style={{ background: '#0F1729' }}>
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div className="h-1.5 w-8 rounded-full bg-white/20" />
                </div>
                {[75, 60, 85, 50, 65].map((w, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${w}%`,
                      background: i === 0 ? '#3B82F6' : 'rgba(255,255,255,0.18)',
                    }}
                  />
                ))}
              </div>
              {/* Content */}
              <div className="absolute left-[28%] right-0 top-0 p-2 flex flex-col gap-1.5">
                <div className="h-2 w-14 bg-gray-800 rounded-full mb-0.5" />
                <div className="grid grid-cols-2 gap-1">
                  {[
                    ['#DBEAFE','#1D4ED8'],
                    ['#DCFCE7','#166534'],
                    ['#FEF3C7','#92400E'],
                    ['#F3E8FF','#6B21A8'],
                  ].map(([bg, text], i) => (
                    <div key={i} className="h-5 rounded-xl flex items-center px-1.5" style={{ background: bg }}>
                      <div className="h-1 w-4 rounded-full" style={{ background: text, opacity: 0.6 }} />
                    </div>
                  ))}
                </div>
                <div className="h-8 rounded-xl bg-white border border-gray-200 mt-0.5" />
              </div>
            </div>

            {/* Label row */}
            <div className="flex items-center justify-between px-2 pt-2 pb-1">
              <div>
                <p className="text-sm font-bold text-gray-900">Классика</p>
                <p className="text-xs text-gray-500 mt-0.5">Текущий дизайн · мягкие тени · закруглённые углы</p>
              </div>
              {design === 'classic' ? (
                <span className="flex items-center gap-1 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Check className="w-2.5 h-2.5" /> Активен
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 font-medium group-hover:text-purple-500 transition-colors">
                  Выбрать
                </span>
              )}
            </div>
          </button>

          {/* ── New "Precision Pro" Design Card ─────────── */}
          <button
            onClick={() => handleSelect('new')}
            disabled={loading}
            className={`group relative rounded-xl border-2 p-1.5 transition-all duration-200 text-left ${
              design === 'new'
                ? 'border-blue-500 shadow-lg shadow-blue-500/15'
                : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
            }`}
          >
            {/* NEW badge */}
            <div className="absolute top-3 right-3 z-10">
              <span className="flex items-center gap-0.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                <Zap className="w-2 h-2" /> New
              </span>
            </div>

            {/* Preview mockup — Precision Pro */}
            <div className="rounded-lg overflow-hidden aspect-[16/9] relative" style={{ background: '#EEF2F9' }}>
              {/* Sidebar — deep navy */}
              <div className="absolute left-0 top-0 bottom-0 w-[26%] flex flex-col gap-1 p-2" style={{ background: '#0D1117' }}>
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-3 h-3 rounded" style={{ background: '#1D4ED8' }} />
                  <div className="h-1.5 w-8 rounded" style={{ background: 'rgba(255,255,255,0.20)' }} />
                </div>
                {[75, 60, 85, 50, 65].map((w, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded"
                    style={{
                      width: `${w}%`,
                      background: i === 0 ? '#1D4ED8' : 'rgba(255,255,255,0.12)',
                      borderLeft: i === 0 ? '2px solid #60A5FA' : undefined,
                    }}
                  />
                ))}
              </div>
              {/* Content — flat, sharp */}
              <div className="absolute left-[28%] right-0 top-0 p-2 flex flex-col gap-1.5">
                {/* Bold editorial heading */}
                <div className="h-2.5 w-16 rounded" style={{ background: '#09090B' }} />
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { bg: '#FFFFFF', accent: '#1D4ED8' },
                    { bg: '#FFFFFF', accent: '#059669' },
                    { bg: '#FFFFFF', accent: '#D97706' },
                    { bg: '#FFFFFF', accent: '#7C3AED' },
                  ].map(({ bg, accent }, i) => (
                    <div
                      key={i}
                      className="h-5 flex items-stretch overflow-hidden"
                      style={{ background: bg, border: '1px solid #DDE3F0', borderRadius: 3, borderTopWidth: 2, borderTopColor: accent }}
                    >
                      <div className="h-1 w-6 m-auto rounded" style={{ background: accent, opacity: 0.4 }} />
                    </div>
                  ))}
                </div>
                {/* Flat table row */}
                <div className="h-7 rounded" style={{ background: '#FFFFFF', border: '1px solid #DDE3F0', borderRadius: 3 }}>
                  <div className="h-full flex items-center px-1.5 gap-1">
                    {[40, 25, 30].map((w, i) => (
                      <div key={i} className="h-1 rounded" style={{ width: `${w}%`, background: '#DDE3F0' }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Label row */}
            <div className="flex items-center justify-between px-2 pt-2 pb-1">
              <div>
                <p className="text-sm font-bold text-gray-900">Precision Pro</p>
                <p className="text-xs text-gray-500 mt-0.5">Новый дизайн · плоские карты · чёткие углы · Plus Jakarta Sans</p>
              </div>
              {design === 'new' ? (
                <span className="flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Check className="w-2.5 h-2.5" /> Активен
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 font-medium group-hover:text-blue-500 transition-colors">
                  Выбрать
                </span>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
