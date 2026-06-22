import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Car, Package, ShoppingCart } from 'lucide-react'

interface FabItem {
  icon: React.ElementType
  label: string
  onClick: () => void
}

export default function CreateFab() {
  const navigate = useNavigate()
  const { t } = useTranslation('cabinet')
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  // Закрытие по Esc
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, close])

  const items: FabItem[] = [
    {
      icon: Car,
      label: t('createFab.vehicle'),
      onClick: () => { navigate('/parts/vehicles'); close() },
    },
    {
      icon: Package,
      label: t('createFab.part'),
      onClick: () => { navigate('/parts/inventory?source=vehicles'); close() },
    },
    {
      icon: ShoppingCart,
      label: t('createFab.order'),
      onClick: () => { navigate('/parts/orders/create'); close() },
    },
  ]

  return (
    <>
      {/* Оверлей-затемнение */}
      <div
        aria-hidden="true"
        className="md:hidden fixed inset-0 z-30 transition-opacity duration-200"
        style={{
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={close}
      />

      {/* Speed-dial контейнер */}
      <div
        className="md:hidden fixed z-40 flex flex-col items-end gap-3"
        style={{
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 1rem)',
          right: '1rem',
        }}
      >
        {/* Пункты speed-dial — рендерим в обратном порядке чтобы нижний был ближе к FAB */}
        {[...items].reverse().map((item, idx) => {
          const Icon = item.icon
          // Задержка для каскадного появления (0 ms для нижнего, +50ms каждый выше)
          const delay = open ? `${idx * 50}ms` : '0ms'
          return (
            <div
              key={item.label}
              className="flex items-center gap-2.5"
              style={{
                opacity: open ? 1 : 0,
                transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)',
                transition: `opacity 200ms ${delay}, transform 200ms ${delay}`,
                pointerEvents: open ? 'auto' : 'none',
              }}
            >
              {/* Подпись */}
              <span className="px-2.5 py-1 rounded-lg text-sm font-semibold text-white select-none"
                style={{
                  background: 'rgba(15,23,42,0.80)',
                  backdropFilter: 'blur(6px)',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </span>

              {/* Иконка-кнопка */}
              <button
                onClick={item.onClick}
                aria-label={item.label}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-white text-gray-800 active:scale-95 transition-transform duration-100"
                style={{
                  boxShadow: '0 4px 16px rgba(15,23,42,0.20), 0 1px 4px rgba(15,23,42,0.12)',
                }}
              >
                <Icon className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
          )
        })}

        {/* Главная FAB-кнопка */}
        <button
          onClick={() => setOpen(prev => !prev)}
          aria-label={open ? t('createFab.closeMenuAria') : t('createFab.createAria')}
          aria-expanded={open}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white active:scale-95"
          style={{
            background: 'var(--cab-ink)',
            boxShadow: open
              ? '0 2px 8px rgba(22,24,29,0.40), 0 8px 24px -4px rgba(22,24,29,0.45)'
              : '0 4px 16px rgba(22,24,29,0.35), 0 2px 6px rgba(22,24,29,0.25)',
            transition: 'box-shadow 200ms',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <Plus className="w-6 h-6" strokeWidth={2} />
          </span>
        </button>
      </div>
    </>
  )
}
