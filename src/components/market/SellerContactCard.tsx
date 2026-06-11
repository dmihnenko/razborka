import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone, Store } from 'lucide-react'
import type { MarketCompanyContact } from '@/types/marketplace'

// ============================================================================
// Карточка контактов продавца (разборки) — для детали товара и страницы разборки
// ============================================================================

export interface SellerContactCardProps {
  company: MarketCompanyContact
  /** id разборки для ссылки (по умолчанию company.id) */
  supplierId?: string
}

/** Чистый номер для tel: */
export function cleanPhone(p: string): string {
  return p.replace(/[^\d+]/g, '')
}

/** Telegram-значение → кликабельная ссылка (username, @username, +номер, url) */
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

export function SellerContactCard({ company, supplierId }: SellerContactCardProps) {
  const phoneRaw = company.phone ? cleanPhone(company.phone) : null
  const tgHref = telegramHref(company.telegram)
  const supplierLink = `/market/supplier/${supplierId ?? company.id}`

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
        Продавец
      </p>
      <Link
        to={supplierLink}
        className="inline-flex items-center gap-1.5 text-base font-bold text-gray-900 hover:text-primary transition-colors leading-snug mb-2.5"
      >
        <Store className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {company.name}
      </Link>

      <div className="space-y-2 text-sm mb-3">
        {company.phone && phoneRaw && (
          <a
            href={`tel:${phoneRaw}`}
            className="flex items-center gap-2 text-gray-700 hover:text-primary transition-colors"
          >
            <Phone className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="font-semibold">{company.phone}</span>
          </a>
        )}
        {company.address && (
          <p className="flex items-start gap-2 text-gray-600">
            <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{company.address}</span>
          </p>
        )}
        {company.email && (
          <a
            href={`mailto:${company.email}`}
            className="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors min-w-0"
          >
            <Mail className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="truncate">{company.email}</span>
          </a>
        )}
      </div>

      {company.description && (
        <p className="text-xs text-gray-500 leading-relaxed mb-3 whitespace-pre-wrap">
          {company.description}
        </p>
      )}

      {(phoneRaw || tgHref) && (
        <div className="flex flex-wrap gap-2">
          {phoneRaw && (
            <a
              href={`tel:${phoneRaw}`}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              <Phone className="w-4 h-4" /> Позвонить
            </a>
          )}
          {tgHref && (
            <a
              href={tgHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 bg-[#229ED9] text-white text-sm font-semibold rounded-lg hover:bg-[#1c8dc2] active:scale-[0.98] transition-all"
            >
              <TelegramIcon className="w-4 h-4 fill-current" /> Telegram
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default SellerContactCard
