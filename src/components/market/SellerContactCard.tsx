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
    <div className="mk-panel">
      {/* Разборка и контакты */}
      <div className="mk-panel-row">
        <Link to={supplierLink} className="flex items-center gap-2.5 min-w-0" aria-label={t('sellerCard.supplierAria', { name: company.name })}>
          <Store className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
          <span className="min-w-0">
            <span className="block text-xs mk-meta">{t('sellerCard.seller')}</span>
            <span className="block text-sm font-semibold leading-snug truncate mk-link" style={{ color: 'var(--mk-text)' }}>{company.name}</span>
          </span>
        </Link>

        {(company.address || company.phone || company.email) && (
          <div className="mt-2 space-y-1.5 text-sm" style={{ color: 'var(--mk-text-2)' }}>
            {company.address && (
              <p className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
                <span className="leading-snug">{company.address}</span>
              </p>
            )}
            {company.phone && phoneRaw && (
              <a href={`tel:${phoneRaw}`} className="flex items-center gap-2.5 min-h-[28px] mk-link" aria-label={t('sellerCard.callAria', { phone: company.phone })}>
                <Phone className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
                <span className="font-semibold" style={{ color: 'var(--mk-text)' }}>{company.phone}</span>
              </a>
            )}
            {company.email && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-2.5 min-h-[28px] min-w-0 mk-link" aria-label={t('sellerCard.emailAria', { email: company.email })}>
                <Mail className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
                <span className="truncate">{company.email}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Доставка */}
      <div className="mk-panel-row flex items-start gap-2.5 text-sm" style={{ color: 'var(--mk-text-2)' }}>
        <Truck className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
        <span>
          <span className="block text-xs mk-meta">{t('sellerCard.delivery')}</span>
          {t('sellerCard.novaPoshta')}, {company.shipSpeed === 'days12' ? t('sellerCard.ship12') : t('sellerCard.shipToday')}
        </span>
      </div>

      {/* Гарантия — только если задана */}
      {company.warrantyEnabled && (company.warrantyDays ?? 0) > 0 && (
        <div className="mk-panel-row flex items-start gap-2.5 text-sm" style={{ color: 'var(--mk-text-2)' }}>
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
          <span>
            <span className="block text-xs mk-meta">{t('sellerCard.warrantyLabel')}</span>
            {t('sellerCard.warranty', { n: company.warrantyDays })}
          </span>
        </div>
      )}

      {company.description && (
        <div className="mk-panel-row">
          <p className="text-xs leading-relaxed whitespace-pre-wrap mk-meta">{company.description}</p>
        </div>
      )}

      {(showCall || tgHref) && (
        <div className="mk-panel-row flex flex-wrap gap-2">
          {showCall && (
            <a href={`tel:${phoneRaw}`} className="mk-btn mk-btn-accent flex-1 min-w-[130px]" aria-label={t('sellerCard.callAria', { phone: company.phone })}>
              <Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> {t('sellerCard.call')}
            </a>
          )}
          {tgHref && (
            <a
              href={tgHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={telegramMessage ? handleWriteTelegram : undefined}
              className="mk-btn mk-btn-outline flex-1 min-w-[130px]"
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
