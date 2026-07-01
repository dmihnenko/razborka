import { Link } from 'react-router-dom'
import { Compass, Store, LogIn } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { usePageMeta } from '@/hooks/usePageMeta'

/**
 * 404 — светлая страница «не найдено» в стиле Ink & Signal.
 * Заменяет прежний молчаливый редирект неизвестного пути на «/».
 */
export default function NotFound() {
  usePageMeta('Страница не найдена — 404', 'Запрошенная страница не существует или была перемещена.')

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4" style={{ background: 'var(--cab-bg)' }}>
      <div className="mb-6">
        <Logo size="sm" withText />
      </div>
      <div className="card text-center max-w-sm w-full">
        <span className="icon-tile-lg mx-auto mb-4 bg-[var(--cab-signal-weak)] text-[var(--cab-signal)]">
          <Compass className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <p className="text-3xl font-extrabold text-gray-900 tracking-tight">404</p>
        <p className="text-sm text-gray-500 mt-1 mb-5">Страница не найдена или была перемещена.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link to="/market" className="btn-primary flex-1">
            <Store className="w-4 h-4" strokeWidth={1.5} /> В каталог
          </Link>
          <Link to="/login" className="btn-secondary flex-1">
            <LogIn className="w-4 h-4" strokeWidth={1.5} /> Войти
          </Link>
        </div>
      </div>
    </div>
  )
}
