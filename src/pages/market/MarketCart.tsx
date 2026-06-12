import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
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
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-3 py-3.5"
    >
      {/* Фото */}
      <Link
        to={`/market/part/${item.inventoryId}`}
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center hover:opacity-90 transition-opacity"
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
          className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 hover:text-primary transition-colors"
        >
          {item.name}
        </Link>
        {conditionLabel && (
          <span className="text-[11px] font-semibold text-gray-400 mt-0.5">{conditionLabel}</span>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
          {/* Количество */}
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl p-1 border border-gray-100">
            <button
              type="button"
              onClick={() => setQty(item.inventoryId, item.quantity - 1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-card transition-all active:scale-90"
              aria-label="Уменьшить количество"
            >
              <Minus className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <span className="w-7 text-center text-sm font-bold text-gray-900 tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => setQty(item.inventoryId, item.quantity + 1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-card transition-all active:scale-90"
              aria-label="Увеличить количество"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-extrabold text-gray-900 whitespace-nowrap tracking-tight">
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
        className="btn-icon-sm self-start text-gray-300 hover:text-red-500 hover:bg-red-50"
        aria-label={`Удалить «${item.name}» из корзины`}
      >
        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </motion.div>
  )
}

// ── Группа по разборке ───────────────────────────────────────────────────────

function CompanyGroup({ group }: { group: CartGroup }) {
  return (
    <section className="card px-5 py-4 space-y-0">
      {/* Шапка группы */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
        <span className="icon-tile-sm bg-blue-50 text-blue-600 flex-shrink-0">
          <Store className="w-4 h-4" strokeWidth={1.5} />
        </span>
        <Link
          to={`/market/supplier/${group.companyId}`}
          className="text-sm font-bold text-gray-900 truncate hover:text-primary transition-colors flex-1"
        >
          {group.companyName}
        </Link>
      </div>

      {/* Позиции */}
      <AnimatePresence initial={false}>
        <div className="divide-y divide-gray-50">
          {group.items.map(item => (
            <CartItemRow key={item.inventoryId} item={item} />
          ))}
        </div>
      </AnimatePresence>

      {/* Итого по группе */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-sm font-semibold text-gray-500">Итого по разборке</span>
        <span className="text-base font-extrabold text-gray-900 tracking-tight">
          {totalsLabel(group.items)}
        </span>
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
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md mx-auto"
      >
        <div className="card px-6 py-12 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5 border border-green-100"
          >
            <CheckCircle2 className="w-10 h-10 text-green-600" strokeWidth={1.5} />
          </motion.div>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Заявка отправлена!</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-xs leading-relaxed">
            Разборка свяжется с вами по указанному телефону, чтобы подтвердить наличие и договориться об оплате и доставке.
          </p>
          <Link to="/market/catalog" className="btn-primary btn-lg mt-6">
            Вернуться в каталог
          </Link>
        </div>
      </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Заголовок */}
      <div className="mb-5">
        <h1 className="page-title">Корзина</h1>
        <p className="page-subtitle">
          {totalCount} шт.
          {' · '}
          {groups.length > 1
            ? `заявки уйдут в ${groups.length} разборки отдельно`
            : 'заявка уйдёт разборке'}
        </p>
      </div>

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
          className="lg:w-80 lg:flex-shrink-0 lg:sticky lg:top-32 card px-5 py-5 flex flex-col gap-4"
        >
          <h2 className="heading-3">Оформление заявки</h2>

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
          <div className="rounded-2xl bg-primary/5 border border-primary/10 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-500">Итого</span>
            <span className="text-xl font-extrabold text-gradient-brand tracking-tight">
              {totalsLabel(items)}
            </span>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary btn-lg w-full disabled:opacity-60 disabled:pointer-events-none"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
            {mutation.isPending ? 'Отправляем…' : 'Отправить заявку'}
          </button>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Без оплаты на сайте: разборка получит вашу заявку и перезвонит, чтобы подтвердить наличие
            {groups.length > 1 ? '. Товары разных разборок уйдут отдельными заявками.' : '.'}
          </p>
        </form>
      </div>
    </motion.div>
  )
}

export default MarketCart
