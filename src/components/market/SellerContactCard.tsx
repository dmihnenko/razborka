import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, MapPin, Phone, Store, Truck, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { MarketCompanyContact } from '@/types/marketplace'

// ============================================================================
// Контакты продавца (Graphite) — для детали товара и страницы разборки
// ============================================================================

export interface SellerContactCardProps {
  company: MarketCompanyContact
  supplierId?: string
  hideCallButton?: boolean
  telegramMessage?: string
}

export function cleanPhone(p: string): string {
  return p.replace(/[^\d+]/g, '')
}

export function telegramHref(tg: string | null | undefined): string | null {
  if (!tg) return null
  const v = tg.trim()
  if (!v) return null
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  if (v.startsWith('@')) return `https://t.me/${v.slice(1)}`
  return `https://t.me/${v}`
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M21.94 4.66a1.13 1.13 0 0 0-1.15-.18L2.9 11.4c-.86.34-.83 1.57.04 1.86l4.4 1.47 1.7 5.18c.1.32.35.45.6.45.22 0 .43-.1.57-.27l2.43-2.86 4.46 3.27c.45.33 1.1.09 1.22-.46l3.2-14.9a1.13 1.13 0 0 0-.4-1.15zM9.5 14.1l-.5 3.5-1.2-3.9 9.3-6.2-7.6 6.6z" />
    </svg>
  )
}

const TILE = 'inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0'

export function SellerContactCard({ company, supplierId, hideCallButton, telegramMessage }: SellerContactCardProps) {
  const { t } = useTranslation('market')
  const phoneRaw = company.phone ? cleanPhone(company.phone) : null
  const tgHref = telegramHref(company.telegram)
  const supplierLink = `/market/supplier/${supplierId ?? company.id}`
  const showCall = !hideCallButton && !!phoneRaw

  const handleWriteTelegram = () => {
    if (!telegramMessage) return
    navigator.clipboard?.writeText(telegramMessage)
      .then(() => toast.success(t('sellerCard.tgCopied')))
      .catch(() => {})
  }

  return (
    <div className="mk-card p-5">
      {/* Продавец */}
      <Link to={supplierLink} className="flex items-center gap-3 mb-4" aria-label={t('sellerCard.supplierAria', { name: company.name })}>
        <span className="mk-tile-icon">
          <Store className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider mk-meta">{t('sellerCard.seller')}</span>
          <span className="block text-base font-bold tracking-tight leading-snug truncate" style={{ color: 'var(--mk-text)' }}>
            {company.name}
          </span>
        </span>
      </Link>

      {/* Контакты */}
      <div className="space-y-1 mb-3 -mx-1.5">
        {company.phone && phoneRaw && (
          <a href={`tel:${phoneRaw}`} className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl text-sm transition-colors hover:bg-[var(--mk-surface-2)]" style={{ color: 'var(--mk-text-2)' }} aria-label={t('sellerCard.callAria', { phone: company.phone })}>
            <span className={TILE} style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}>
              <Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="font-semibold" style={{ color: 'var(--mk-text)' }}>{company.phone}</span>
          </a>
        )}
        {company.address && (
          <p className="flex items-start gap-2.5 px-1.5 py-1.5 text-sm" style={{ color: 'var(--mk-text-2)' }}>
            <span className={`${TILE} mt-0.5`} style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}>
              <MapPin className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="leading-snug pt-1">{company.address}</span>
          </p>
        )}
        {company.email && (
          <a href={`mailto:${company.email}`} className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl text-sm transition-colors hover:bg-[var(--mk-surface-2)] min-w-0" style={{ color: 'var(--mk-text-2)' }} aria-label={t('sellerCard.emailAria', { email: company.email })}>
            <span className={TILE} style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}>
              <Mail className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="truncate">{company.email}</span>
          </a>
        )}
      </div>

      {/* Доставка и гарантия — отдельными пунктами */}
      <div className="space-y-1 mb-3 -mx-1.5 pt-2" style={{ borderTop: '1px solid var(--mk-border)' }}>
        <div className="flex items-center gap-2.5 px-1.5 py-1.5 text-sm" style={{ color: 'var(--mk-text-2)' }}>
          <span className={TILE} style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}>
            <Truck className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span>{t('sellerCard.novaPoshta')} · {company.shipSpeed === 'days12' ? t('sellerCard.ship12') : t('sellerCard.shipToday')}</span>
        </div>
        {company.warrantyEnabled && (company.warrantyDays ?? 0) > 0 && (
          <div className="flex items-center gap-2.5 px-1.5 py-1.5 text-sm" style={{ color: 'var(--mk-text-2)' }}>
            <span className={TILE} style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}>
              <ShieldCheck className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span>{t('sellerCard.warranty', { n: company.warrantyDays })}</span>
          </div>
        )}
      </div>

      {company.description && (
        <p className="text-xs leading-relaxed mb-4 whitespace-pre-wrap mk-meta">{company.description}</p>
      )}

      {(showCall || tgHref) && (
        <div className="flex flex-wrap gap-2.5">
          {showCall && (
            <a href={`tel:${phoneRaw}`} className="mk-btn mk-btn-accent flex-1 sm:flex-none min-w-[140px]" aria-label={t('sellerCard.callAria', { phone: company.phone })}>
              <Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> {t('sellerCard.call')}
            </a>
          )}
          {tgHref && (
            <a
              href={tgHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={telegramMessage ? handleWriteTelegram : undefined}
              className="mk-btn mk-btn-outline flex-1 sm:flex-none min-w-[140px]"
              aria-label={telegramMessage ? t('sellerCard.tgWriteAria') : t('sellerCard.tgOpenAria')}
            >
              <TelegramIcon className="w-4 h-4 fill-current" /> {telegramMessage ? t('sellerCard.write') : t('sellerCard.telegram')}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default SellerContactCard
