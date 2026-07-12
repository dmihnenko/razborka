import { RefreshCw } from 'lucide-react'

interface Props {
  pull: number
  refreshing: boolean
  threshold?: number
}

/**
 * Визуальный индикатор pull-to-refresh: круглый спиннер сверху по центру,
 * выезжает по мере протяжки, крутится во время обновления. Только на тач/мобиле.
 */
export function PullToRefreshIndicator({ pull, refreshing, threshold = 70 }: Props) {
  const visible = pull > 0 || refreshing
  const ready = pull >= threshold
  const y = refreshing ? threshold : pull

  return (
    <div
      aria-hidden="true"
      className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none md:hidden"
      style={{
        top: 'env(safe-area-inset-top, 0px)',
        transform: `translateY(${Math.max(-44, y - 44)}px)`,
        opacity: visible ? 1 : 0,
        transition: (refreshing || pull === 0) ? 'transform .25s ease, opacity .2s' : 'opacity .12s',
      }}
    >
      <div className="mt-2 w-9 h-9 rounded-full bg-white flex items-center justify-center"
        style={{ boxShadow: '0 4px 14px -4px rgba(16,24,40,.28)', border: '1px solid rgba(16,24,40,.08)' }}>
        <RefreshCw
          className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
          strokeWidth={1.9}
          style={{
            color: ready || refreshing ? 'var(--cab-signal, #3538CD)' : '#9AA1AC',
            transform: refreshing ? undefined : `rotate(${Math.min(180, (pull / threshold) * 180)}deg)`,
            transition: 'color .15s',
          }}
        />
      </div>
    </div>
  )
}

export default PullToRefreshIndicator
