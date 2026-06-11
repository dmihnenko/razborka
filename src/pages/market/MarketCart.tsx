import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Send,
  ShoppingCart,
  Store,
  Trash2,
} from 'lucide-react'
import { useCart, type CartGroup } from '@/hooks/useCart'
import { submitMarketOrders } from '@/services/marketplaceService'
import type { CartItem, MarketCurrency } from '@/types/marketplace'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'
import EmptyState from '@/components/ui/EmptyState'

// ============================================================================
// Корзина маркетплейса + оформление заявки (/market/cart)
// Покупка без оплаты: покупатель оставляет телефон, по одной заявке на разборку
// ============================================================================

/** Сумма позиций с разбивкой по валюте — товары UAH и USD не смешиваем */
function sumByCurrency(items: CartItem[]): { currency: MarketCurrency; amount: number }[] {
  const map = new Map<MarketCurrency, number>()
  for (const i of items) {
    map.set(i.priceCurrency, (map.get(i.priceCurrency) ?? 0) + i.sellingPrice * i.quantity)
  }
  // UAH первой, затем USD
  return (['UAH', 'USD'] as MarketCurrency[])
    .filter(c => map.has(c))
    .map(c => ({ currency: c, amount: map.get(c)! }))
}

function totalsLabel(items: CartItem[]): string {
  return sumByCurrency(items)
    .map(t => formatPrice(t.amount, t.currency))
    .join(' + ')
}

// ── Строка товара ────────────────────────────────────────────────────────────

function CartItemRow({ item }: { item: CartItem }) {
  const { setQty, removeItem } = useCart()
  const [imgError, setImgError] = useState(false)
  const conditionLabel = item.condition
    ? PARTS_CONDITION_LABELS[item.condition] ?? item.condition
    : null

  return (
    <div className="flex gap-3 py-3">
      {/* Фото */}
      <Link
        to={`/market/part/${item.inventoryId}`}
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center"
        aria-label={item.name}
      >
        {item.photoUrl && !imgError ? (
          <img
            src={item.photoUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="w-7 h-7 text-gray-300" strokeWidth={1.5} />
        )}
      </Link>

      {/* Название · состояние · цена */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Link
          to={`/market/part/${item.inventoryId}`}
          className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 hover:text-primary transition-colors"
        >
          {item.name}
        </Link>
        {conditionLabel && (
          <span className="text-[11px] text-gray-400 mt-0.5">{conditionLabel}</span>
        )}

        <div className="mt-auto pt-1.5 flex items-center justify-between gap-2 flex-wrap">
          {/* Количество */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQty(item.inventoryId, item.quantity - 1)}
              className="btn-icon-sm border border-gray-200"
              aria-label="Уменьшить количество"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-semibold text-gray-900 tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => setQty(item.inventoryId, item.quantity + 1)}
              className="btn-icon-sm border border-gray-200"
              aria-label="Увеличить количество"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
              {formatPrice(item.sellingPrice * item.quantity, item.priceCurrency)}
            </span>
            {item.quantity > 1 && (
              <span className="text-[11px] text-gray-400 whitespace-nowrap">
                ({formatPrice(item.sellingPrice, item.priceCurrency)} / шт.)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Удалить */}
      <button
        type="button"
        onClick={() => {
          removeItem(item.inventoryId)
          toast.success('Удалено из корзины')
        }}
        className="btn-icon-sm self-start text-gray-300 hover:text-red-600 hover:bg-red-50"
        aria-label={`Удалить «${item.name}» из корзины`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Группа по разборке ───────────────────────────────────────────────────────

function CompanyGroup({ group }: { group: CartGroup }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <Store className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <Link
          to={`/market/supplier/${group.companyId}`}
          className="text-sm font-semibold text-gray-900 truncate hover:text-primary transition-colors"
        >
          {group.companyName}
        </Link>
      </div>

      <div className="divide-y divide-gray-100">
        {group.items.map(item => (
          <CartItemRow key={item.inventoryId} item={item} />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-sm text-gray-500">Итого по разборке</span>
        <span className="text-base font-bold text-gray-900">{totalsLabel(group.items)}</span>
      </div>
    </section>
  )
}

// ── Страница ─────────────────────────────────────────────────────────────────

export function MarketCart() {
  const { items, clear, totalCount, groupedByCompany } = useCart()

  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const groups = groupedByCompany()
  const phoneDigits = phone.replace(/\D/g, '')
  const phoneValid = phoneDigits.length === 12 // +380 XX XXX-XX-XX

  const mutation = useMutation({
    mutationFn: (vars: {
      groups: { companyId: string; items: CartItem[] }[]
      buyer: { phone: string; name?: string; comment?: string }
    }) => submitMarketOrders(vars.groups, vars.buyer),
    onSuccess: () => {
      clear()
      setSubmitted(true)
      toast.success('Заявка отправлена')
    },
    onError: () => {
      toast.error('Не удалось отправить заявку. Попробуйте ещё раз')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!phoneValid) {
      setPhoneError('Укажите телефон полностью — разборка свяжется с вами по нему')
      return
    }
    setPhoneError(null)
    mutation.mutate({
      groups: groups.map(g => ({ companyId: g.companyId, items: g.items })),
      buyer: { phone: phone.trim(), name: name.trim() || undefined, comment: comment.trim() || undefined },
    })
  }

  // ── Экран подтверждения ──
  if (submitted) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Заявка отправлена</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-xs">
            Разборка свяжется с вами по указанному телефону, чтобы подтвердить наличие и договориться об оплате и доставке.
          </p>
          <Link to="/market/catalog" className="btn-primary mt-6">
            Вернуться в каталог
          </Link>
        </div>
      </div>
    )
  }

  // ── Пустая корзина ──
  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto">
        <EmptyState
          icon={ShoppingCart}
          title="Корзина пуста"
          description="Добавьте запчасти из каталога — оплата не требуется, вы просто оставляете заявку разборке"
          action={
            <Link to="/market/catalog" className="btn-primary">
              Перейти в каталог
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Корзина</h1>
      <p className="text-sm text-gray-500 mb-4">
        {totalCount} шт. · {groups.length > 1 ? `заявки уйдут в ${groups.length} разборки отдельно` : 'заявка уйдёт разборке'}
      </p>

      <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
        {/* ── Позиции по разборкам ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {groups.map(group => (
            <CompanyGroup key={group.companyId} group={group} />
          ))}
        </div>

        {/* ── Форма заявки ── */}
        <form
          onSubmit={handleSubmit}
          className="lg:w-80 lg:flex-shrink-0 lg:sticky lg:top-32 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 flex flex-col gap-3"
        >
          <h2 className="text-base font-bold text-gray-900">Оформление заявки</h2>

          <div>
            <label htmlFor="cart-phone" className="form-label">
              Телефон <span className="text-red-500">*</span>
            </label>
            <IMaskInput
              id="cart-phone"
              mask="+380 00 000-00-00"
              value={phone}
              onAccept={(value: string) => {
                setPhone(value)
                if (phoneError) setPhoneError(null)
              }}
              type="tel"
              autoComplete="tel"
              className="form-input"
              placeholder="+380 XX XXX-XX-XX"
              aria-invalid={!!phoneError}
            />
            {phoneError && <p className="form-error">{phoneError}</p>}
          </div>

          <div>
            <label htmlFor="cart-name" className="form-label">Имя</label>
            <input
              id="cart-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              maxLength={100}
              className="form-input"
              placeholder="Как к вам обращаться (необязательно)"
            />
          </div>

          <div>
            <label htmlFor="cart-comment" className="form-label">Комментарий</label>
            <textarea
              id="cart-comment"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              className="form-input resize-none"
              placeholder="Уточнения по запчастям, доставке… (необязательно)"
            />
          </div>

          {/* Итого */}
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Итого</span>
            <span className="text-lg font-bold text-gray-900">{totalsLabel(items)}</span>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary btn-lg w-full disabled:opacity-60 disabled:pointer-events-none"
          >
            <Send className="w-4 h-4" />
            {mutation.isPending ? 'Отправляем…' : 'Отправить заявку'}
          </button>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Без оплаты на сайте: разборка получит вашу заявку и перезвонит, чтобы подтвердить наличие
            {groups.length > 1 ? '. Товары разных разборок уйдут отдельными заявками.' : '.'}
          </p>
        </form>
      </div>
    </div>
  )
}

export default MarketCart
