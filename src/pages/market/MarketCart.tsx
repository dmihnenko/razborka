import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import { CheckCircle2, Minus, Package, Plus, Send, ShoppingCart, Store, Trash2 } from 'lucide-react'
import { useCart, type CartGroup } from '@/hooks/useCart'
import { submitMarketOrders } from '@/services/marketplaceService'
import type { CartItem, MarketCurrency } from '@/types/marketplace'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'
import EmptyState from '@/components/ui/EmptyState'

// ============================================================================
// Корзина + оформление заявки (/market/cart) — Graphite. Логика не тронута.
// ============================================================================

function sumByCurrency(items: CartItem[]): { currency: MarketCurrency; amount: number }[] {
  const map = new Map<MarketCurrency, number>()
  for (const i of items) map.set(i.priceCurrency, (map.get(i.priceCurrency) ?? 0) + i.sellingPrice * i.quantity)
  return (['UAH', 'USD'] as MarketCurrency[]).filter(c => map.has(c)).map(c => ({ currency: c, amount: map.get(c)! }))
}
function totalsLabel(items: CartItem[]): string {
  return sumByCurrency(items).map(t => formatPrice(t.amount, t.currency)).join(' + ')
}

function CartItemRow({ item }: { item: CartItem }) {
  const { setQty, removeItem } = useCart()
  const [imgError, setImgError] = useState(false)
  const conditionLabel = item.condition ? PARTS_CONDITION_LABELS[item.condition] ?? item.condition : null

  return (
    <div className="flex gap-3 py-3.5">
      <Link to={`/market/part/${item.inventoryId}`} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center hover:opacity-90 transition-opacity" style={{ background: 'var(--mk-surface-2)' }} aria-label={item.name}>
        {item.photoUrl && !imgError ? (
          <img src={item.photoUrl} alt={item.name} loading="lazy" decoding="async" onError={() => setImgError(true)} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-7 h-7" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col">
        <Link to={`/market/part/${item.inventoryId}`} className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--mk-text)' }}>{item.name}</Link>
        {conditionLabel && <span className="text-[11px] font-semibold mt-0.5 mk-meta">{conditionLabel}</span>}

        <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="mk-qty">
            <button type="button" onClick={() => setQty(item.inventoryId, item.quantity - 1)} className="mk-qty-btn" aria-label={`Уменьшить количество «${item.name}»`}>
              <Minus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="mk-qty-val" aria-live="polite">{item.quantity}</span>
            <button type="button" onClick={() => setQty(item.inventoryId, item.quantity + 1)} className="mk-qty-btn" aria-label={`Увеличить количество «${item.name}»`}>
              <Plus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="mk-price text-sm whitespace-nowrap">{formatPrice(item.sellingPrice * item.quantity, item.priceCurrency)}</span>
            {item.quantity > 1 && <span className="text-[11px] whitespace-nowrap mk-meta">({formatPrice(item.sellingPrice, item.priceCurrency)} / шт.)</span>}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { removeItem(item.inventoryId); toast.success('Удалено из корзины') }}
        className="mk-icon-btn self-start hover:!bg-[#FEF1F1] hover:!text-[#9B3535]"
        aria-label={`Удалить «${item.name}» из корзины`}
      >
        <Trash2 className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}

function CompanyGroup({ group }: { group: CartGroup }) {
  return (
    <section className="mk-card px-5 py-4" aria-label={`Товары разборки ${group.companyName}`}>
      <div className="flex items-center gap-2.5 pb-3 mk-divider" style={{ borderTop: 'none', borderBottom: '1px solid var(--mk-border)' }}>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}>
          <Store className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <Link to={`/market/supplier/${group.companyId}`} className="text-sm font-bold truncate flex-1" style={{ color: 'var(--mk-text)' }}>{group.companyName}</Link>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--mk-border)' }}>
        {group.items.map(item => <CartItemRow key={item.inventoryId} item={item} />)}
      </div>

      <div className="flex items-center justify-between pt-3 mk-divider">
        <span className="text-sm font-semibold mk-meta">Итого по разборке</span>
        <span className="text-base font-extrabold tracking-tight" style={{ color: 'var(--mk-text)' }}>{totalsLabel(group.items)}</span>
      </div>
    </section>
  )
}

export function MarketCart() {
  const { items, clear, totalCount, groupedByCompany } = useCart()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const groups = groupedByCompany()
  const phoneDigits = phone.replace(/\D/g, '')
  const phoneValid = phoneDigits.length === 12
  const nameValid = name.trim().length > 0

  const mutation = useMutation({
    mutationFn: (vars: { groups: { companyId: string; items: CartItem[] }[]; buyer: { phone: string; name?: string; comment?: string } }) => submitMarketOrders(vars.groups, vars.buyer),
    onSuccess: () => { clear(); setSubmitted(true); toast.success('Заявка отправлена') },
    onError: () => { toast.error('Не удалось отправить заявку. Попробуйте ещё раз') },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!phoneValid) { setPhoneError('Укажите телефон полностью — разборка свяжется с вами по нему'); return }
    setPhoneError(null)
    if (!nameValid) { setNameError('Укажите имя — как к вам обращаться'); return }
    setNameError(null)
    mutation.mutate({
      groups: groups.map(g => ({ companyId: g.companyId, items: g.items })),
      buyer: { phone: phone.trim(), name: name.trim(), comment: comment.trim() || undefined },
    })
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto">
        <div className="mk-card px-6 py-12 flex flex-col items-center text-center">
          <span className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: '#ECFDF3', color: '#246B45', border: '1px solid #C9EAD6' }}>
            <CheckCircle2 className="w-10 h-10" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--mk-text)' }}>Заявка отправлена!</h1>
          <p className="mk-sub mt-2 max-w-xs leading-relaxed">Разборка свяжется с вами по указанному телефону, чтобы подтвердить наличие и договориться об оплате и доставке.</p>
          <Link to="/market/catalog" className="mk-btn mk-btn-accent mk-btn-lg mt-6">Вернуться в каталог</Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto">
        <EmptyState icon={ShoppingCart} title="Корзина пуста" description="Добавьте запчасти из каталога — оплата не требуется, вы просто оставляете заявку разборке" action={<Link to="/market/catalog" className="mk-btn mk-btn-accent">Перейти в каталог</Link>} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="mk-h1">Корзина</h1>
        <p className="mk-sub mt-1">{totalCount} шт. · {groups.length > 1 ? `заявки уйдут в ${groups.length} разборки отдельно` : 'заявка уйдёт разборке'}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {groups.map(group => <CompanyGroup key={group.companyId} group={group} />)}
        </div>

        <form onSubmit={handleSubmit} className="lg:w-80 lg:flex-shrink-0 lg:sticky lg:top-24 mk-card px-5 py-5 flex flex-col gap-4">
          <h2 className="mk-title">Оформление заявки</h2>

          <div>
            <label htmlFor="cart-phone" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--mk-text-2)' }}>Телефон <span style={{ color: '#9B3535' }}>*</span></label>
            <IMaskInput
              id="cart-phone" mask="+380 00 000-00-00" value={phone}
              onAccept={(value: string) => { setPhone(value); if (phoneError) setPhoneError(null) }}
              type="tel" autoComplete="tel" className="mk-input" placeholder="+380 XX XXX-XX-XX"
              aria-invalid={!!phoneError} aria-describedby={phoneError ? 'cart-phone-error' : undefined}
            />
            {phoneError && <p id="cart-phone-error" className="text-xs mt-1" style={{ color: '#9B3535' }}>{phoneError}</p>}
          </div>

          <div>
            <label htmlFor="cart-name" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--mk-text-2)' }}>Имя <span style={{ color: '#9B3535' }}>*</span></label>
            <input
              id="cart-name" type="text" value={name}
              onChange={e => { setName(e.target.value); if (nameError) setNameError(null) }}
              autoComplete="name" maxLength={100} className="mk-input" placeholder="Как к вам обращаться"
              aria-invalid={!!nameError} aria-describedby={nameError ? 'cart-name-error' : undefined}
            />
            {nameError && <p id="cart-name-error" className="text-xs mt-1" style={{ color: '#9B3535' }}>{nameError}</p>}
          </div>

          <div>
            <label htmlFor="cart-comment" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--mk-text-2)' }}>Комментарий</label>
            <textarea id="cart-comment" value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={1000} className="mk-input resize-none !h-auto py-2.5" placeholder="Уточнения по запчастям, доставке… (необязательно)" />
          </div>

          <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: 'var(--mk-surface-2)' }}>
            <span className="text-sm font-semibold mk-meta">Итого</span>
            <span className="mk-price-lg !text-xl">{totalsLabel(items)}</span>
          </div>

          <button type="submit" disabled={mutation.isPending} className="mk-btn mk-btn-accent mk-btn-lg w-full disabled:opacity-60 disabled:pointer-events-none">
            <Send className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            {mutation.isPending ? 'Отправляем…' : 'Отправить заявку'}
          </button>

          <p className="text-[11px] leading-relaxed mk-meta">
            Без оплаты на сайте: разборка получит вашу заявку и перезвонит, чтобы подтвердить наличие{groups.length > 1 ? '. Товары разных разборок уйдут отдельными заявками.' : '.'}
          </p>
        </form>
      </div>
    </div>
  )
}

export default MarketCart
