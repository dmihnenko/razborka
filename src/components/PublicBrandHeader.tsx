import { Logo } from '@/components/brand/Logo'

interface Props {
  subtitle?: string
}

// Шапка публичных страниц (QR/ссылки на запчасть, авто, локацию).
// Светлая, с актуальной эмблемой Razborka.net (ink-монохром, без синего).
export function PublicBrandHeader({ subtitle }: Props) {
  return (
    <div style={{ background: '#FFFFFF', borderBottom: '1px solid var(--cab-border, #E5E8F0)' }}>
      <div className="px-4 sm:px-6 flex items-center gap-3 py-3">
        <Logo size="sm" withText className="flex-shrink-0" />
        {subtitle && (
          <span
            className="min-w-0 truncate"
            style={{ color: 'var(--cab-ink-3, #8B909A)', fontSize: '12px', fontWeight: 600 }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}
