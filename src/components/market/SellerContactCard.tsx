import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone, Store } from 'lucide-react'
import { toast } from 'sonner'
import type { MarketCompanyContact } from '@/types/marketplace'

// ============================================================================
// Карточка контактов продавца (разборки) — для детали товара и страницы разборки
// ============================================================================

export interface SellerContactCardProps {
  company: MarketCompanyContact
  /** id разборки для ссылки (по умолчанию company.id) */
  supplierId?: string
  /** Скрыть кнопку «Позвонить» (напр. на странице товара) */
  hideCallButton?: boolean
  /** Если задан — кнопка Telegram становится «Написать» и копирует этот шаблон в буфер */
  telegramMessage?: string
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

export function SellerContactCard({ company, supplierId, hideCallButton, telegramMessage }: SellerContactCardProps) {
  const phoneRaw = company.phone ? cleanPhone(company.phone) : null
  const tgHref = telegramHref(company.telegram)
  const supplierLink = `/market/supplier/${supplierId ?? company.id}`
  const showCall = !hideCallButton && !!phoneRaw

  const handleWriteTelegram = () => {
    if (!telegramMessage) return
    navigator.clipboard?.writeText(telegramMessage)
      .then(() => toast.success('Шаблон сообщения скопирован — вставьте в чат с разборкой'))
      .catch(() => {})
  }

  return (
    <div className="card p-5">
      {/* Шапка: продавец */}
      <Link to={supplierLink} className="flex items-center gap-3 mb-4 group" aria-label={`Разборка ${company.name}`}>
        <span className="icon-tile bg-primary/10 text-primary">
          <Store className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Продавец
          </span>
          <span className="block text-base font-extrabold tracking-tight text-gray-900 leading-snug truncate group-hover:text-primary transition-colors">
            {company.name}
          </span>
        </span>
      </Link>

      {/* Контакты */}
      <div className="space-y-1 mb-3 -mx-1.5">
        {company.phone && phoneRaw && (
          <a
            href={`tel:${phoneRaw}`}
            className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 hover:text-primary active:scale-[0.99] transition-all"
            aria-label={`Позвонить ${company.phone}`}
          >
            <span className="icon-tile-sm bg-green-50 text-green-600">
              <Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="font-semibold">{company.phone}</span>
          </a>
        )}
        {company.address && (
          <p className="flex items-start gap-2.5 px-1.5 py-1.5 text-sm text-gray-600">
            <span className="icon-tile-sm bg-orange-50 text-orange-500">
              <MapPin className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="leading-snug pt-1">{company.address}</span>
          </p>
        )}
        {company.email && (
          <a
            href={`mailto:${company.email}`}
            className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-primary active:scale-[0.99] transition-all min-w-0"
            aria-label={`Написать на почту ${company.email}`}
          >
            <span className="icon-tile-sm bg-primary/10 text-primary">
              <Mail className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="truncate">{company.email}</span>
          </a>
        )}
      </div>

      {company.description && (
        <p className="text-xs text-gray-500 leading-relaxed mb-4 whitespace-pre-wrap">
          {company.description}
        </p>
      )}

      {(showCall || tgHref) && (
        <div className="flex flex-wrap gap-2.5">
          {showCall && (
            <a
              href={`tel:${phoneRaw}`}
              className="btn-primary flex-1 sm:flex-none min-w-[140px] min-h-[44px]"
              aria-label={`Позвонить ${company.phone}`}
            >
              <Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> Позвонить
            </a>
          )}
          {tgHref && (
            <a
              href={tgHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={telegramMessage ? handleWriteTelegram : undefined}
              className="btn flex-1 sm:flex-none min-w-[140px] min-h-[44px] px-4 py-2 text-sm text-white"
              aria-label={telegramMessage ? 'Написать в Telegram' : 'Открыть Telegram разборки'}
              style={{
                backgroundImage: 'linear-gradient(180deg, #2AABEE 0%, #229ED9 100%)',
                boxShadow: '0 1px 2px rgba(34,158,217,0.35), 0 4px 12px -2px rgba(34,158,217,0.35)',
              }}
            >
              <TelegramIcon className="w-4 h-4 fill-current" /> {telegramMessage ? 'Написать' : 'Telegram'}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default SellerContactCard
