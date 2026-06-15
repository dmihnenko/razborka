import { useEffect, useMemo, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Car, ChevronRight, Copy, FileText, Package, ShoppingCart, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { getMarketPart, getRelatedParts } from '@/services/marketplaceService'
import type { MarketPart } from '@/types/marketplace'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'
import { Spinner } from '@/components/ui/Spinner'
import PhotoGallery from '@/components/parts/PhotoGallery'
import type { ImgbbPhoto } from '@/services/imgbbService'
import { SellerContactCard } from '@/components/market/SellerContactCard'
import { MarketProductCard } from '@/components/market/MarketProductCard'

// ============================================================================
// Страница товара — стиль 2026 «индустриальный»: бенто-сетка 6 колонок, плоско,
// средне-стальные тона + один кобальтовый акцент. Токены scoped на обёртке.
// ============================================================================

// Дизайн-токены спеки (scoped, чтобы не пересекаться с глобальными)
const TOKENS: CSSProperties = {
  ['--g' as any]: '#2C353D', ['--steel' as any]: '#455058', ['--slate' as any]: '#6E7980',
  ['--muted' as any]: '#8B949B', ['--concrete' as any]: '#B0B7BB', ['--bd' as any]: '#DDE1E3',
  ['--bd-soft' as any]: '#E2E5E6', ['--fog' as any]: '#ECEEEF', ['--surface' as any]: '#FFFFFF',
  ['--inset' as any]: '#F6F7F8', ['--inset2' as any]: '#F2F4F6', ['--accent' as any]: '#1F5FCC',
  ['--accent-hover' as any]: '#17499E', ['--accent-soft' as any]: '#E7EEFA', ['--accent-on-soft' as any]: '#17499E',
  ['--ok-bg' as any]: '#E8F2EC', ['--ok-text' as any]: '#22663F', ['--ok-bar' as any]: '#2F8F5B',
}

const cell: CSSProperties = {
  background: 'var(--surface)', border: '0.5px solid var(--bd)', borderRadius: '14px',
}

const CONDITION_TONE: Record<string, { bg: string; text: string }> = {
  new: { bg: 'var(--ok-bg)', text: 'var(--ok-text)' },
  used: { bg: 'var(--inset2)', text: 'var(--steel)' },
  damaged: { bg: '#F6E9E7', text: '#9A3324' },
}

function toGalleryPhotos(part: MarketPart): ImgbbPhoto[] {
  return (part.photos ?? [])
    .filter(p => p?.url || p?.display_url)
    .map(p => ({
      url: p.url || p.display_url || '',
      medium_url: p.medium_url || p.display_url,
      thumb_url: p.thumb_url || p.url || p.display_url || '',
      delete_url: '',
    }))
}

export default function MarketProductPage() {
  const { id } = useParams<{ id: string }>()
  const { addItem, items } = useCart()

  useEffect(() => { window.scrollTo({ top: 0 }) }, [id])

  const { data: part, isLoading } = useQuery({
    queryKey: ['market-part', id], queryFn: () => getMarketPart(id!), enabled: !!id, staleTime: 60_000,
  })
  const { data: related = [] } = useQuery({
    queryKey: ['market-related', part?.company.id, id],
    queryFn: () => getRelatedParts(part!.company.id, part!.id),
    enabled: !!part?.company.id, staleTime: 60_000,
  })

  const galleryPhotos = useMemo(() => (part ? toGalleryPhotos(part) : []), [part])

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  if (!part) {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center justify-center w-20 h-20 rounded-2xl" style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-3)' }}>
          <Package className="w-9 h-9" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--mk-text)' }}>Товар не найден</p>
          <p className="mk-sub mt-1">Возможно, запчасть уже продана или снята с публикации</p>
        </div>
        <Link to="/market/catalog" className="mk-btn mk-btn-accent mt-1">Перейти в каталог</Link>
      </div>
    )
  }

  const photo = part.photoUrl || part.photos?.[0]?.thumb_url || part.photos?.[0]?.url || null
  const inCart = items.some(i => i.inventoryId === part.id)
  const conditionLabel = PARTS_CONDITION_LABELS[part.condition] ?? part.condition
  const condTone = CONDITION_TONE[part.condition] ?? CONDITION_TONE.used
  const code = (part.partNumber || part.id.slice(0, 8)).toUpperCase()
  const vehicleStr = part.vehicle ? `${part.vehicle.make} ${part.vehicle.model}${part.vehicle.year ? `, ${part.vehicle.year}` : ''}` : null

  const handleAddToCart = () => {
    addItem({
      inventoryId: part.id, name: part.name, sellingPrice: part.sellingPrice, priceCurrency: part.priceCurrency,
      photoUrl: photo, quantity: 1, companyId: part.company.id, companyName: part.company.name, condition: part.condition,
    })
    toast.success('Добавлено в корзину')
  }

  const copyPartNumber = () => {
    if (!part.partNumber) return
    navigator.clipboard.writeText(part.partNumber.toUpperCase())
    toast.success('Номер скопирован')
  }

  // Чипы совместимости (только реальные данные)
  const chips = [
    part.vehicle?.make && { k: 'Марка', v: part.vehicle.make },
    part.vehicle?.model && { k: 'Модель', v: part.vehicle.model },
    part.partNumber && { k: 'OEM', v: part.partNumber.toUpperCase(), mono: true },
    part.categoryName && { k: 'Категория', v: part.categoryName },
  ].filter(Boolean) as { k: string; v: string; mono?: boolean }[]

  // Характеристики ключ-значение
  const specs = [
    part.partNumber && { k: 'OEM-номер', v: part.partNumber.toUpperCase(), mono: true },
    { k: 'Состояние', v: conditionLabel },
    part.categoryName && { k: 'Категория', v: part.categoryName },
    part.quantity > 1 && { k: 'В наличии', v: `${part.quantity} шт.` },
  ].filter(Boolean) as { k: string; v: string; mono?: boolean }[]

  return (
    <div style={TOKENS}>
      {/* Шапка: крошки + код */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <nav aria-label="Хлебные крошки" className="min-w-0">
          <ol className="flex items-center gap-1 text-xs sm:text-sm min-w-0" style={{ color: 'var(--muted)' }}>
            <li><Link to="/market" className="font-medium" style={{ color: 'var(--accent)' }}>Маркет</Link></li>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--concrete)' }} />
            <li><Link to="/market/catalog" className="font-medium" style={{ color: 'var(--accent)' }}>Каталог</Link></li>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--concrete)' }} />
            <li className="truncate min-w-0" aria-current="page" style={{ color: 'var(--steel)' }}>{part.name}</li>
          </ol>
        </nav>
        <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{code}</span>
      </div>

      {/* Бенто-сетка */}
      <div className="rounded-2xl p-3.5" style={{ background: 'var(--fog)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-2.5">

          {/* Галерея фото — span 3, rows 2 */}
          <div className="lg:col-span-3 lg:row-span-2 min-w-0">
            {galleryPhotos.length > 0 ? (
              <div className="overflow-hidden h-full" style={{ ...cell, padding: 0 }}>
                <PhotoGallery photos={galleryPhotos} alt={part.name} mainAspect="aspect-[4/3]" />
              </div>
            ) : (
              <div className="aspect-[4/3] flex flex-col items-center justify-center gap-3" style={{ ...cell, color: 'var(--muted)' }}>
                <Package className="w-12 h-12" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-sm">Нет фото</span>
              </div>
            )}
          </div>

          {/* Блок покупки — span 3 */}
          <div className="lg:col-span-3 flex flex-col" style={{ ...cell, padding: '15px 17px' }}>
            <span className="inline-flex items-center self-start gap-1.5 text-xs font-medium px-2 h-6 rounded-md mb-2"
              style={{ background: condTone.bg, color: condTone.text }}>
              {conditionLabel}
            </span>
            <h1 className="text-[20px] font-medium leading-[1.22]" style={{ color: 'var(--g)' }}>{part.name}</h1>
            {vehicleStr && <p className="text-sm mt-1" style={{ color: 'var(--slate)' }}>{vehicleStr}</p>}

            {/* Цена */}
            <div className="mt-3 rounded-[11px] p-3.5" style={{ background: 'var(--inset)' }}>
              <p className="text-[31px] font-medium leading-none" style={{ color: 'var(--g)', letterSpacing: '-0.6px' }}>
                {formatPrice(part.sellingPrice, part.priceCurrency)}
              </p>
              {part.quantity > 1 && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>В наличии: <span className="font-medium" style={{ color: 'var(--steel)' }}>{part.quantity} шт.</span></p>
              )}
            </div>

            {/* Кнопки */}
            <div className="mt-3 space-y-2">
              {inCart ? (
                <Link to="/market/cart" className="ind-btn-accent w-full">
                  <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> Перейти в корзину
                </Link>
              ) : (
                <button type="button" onClick={handleAddToCart} className="ind-btn-accent w-full">
                  <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> Купить
                </button>
              )}
              {part.partNumber && (
                <button type="button" onClick={copyPartNumber}
                  className="ind-btn-soft w-full" title="Скопировать оригинальный номер">
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                  <span className="font-mono">{part.partNumber.toUpperCase()}</span>
                </button>
              )}
            </div>
          </div>

          {/* Чипы совместимости — span 6 */}
          {chips.length > 0 && (
            <div className="lg:col-span-6 flex flex-wrap gap-2" style={{ ...cell, padding: '12px 14px' }}>
              {chips.map((c, i) => (
                <div key={i} className="flex flex-col gap-0.5 px-3 py-1.5 rounded-[9px] min-w-[88px]" style={{ background: 'var(--inset2)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--slate)' }}>{c.k}</span>
                  <span className={`text-sm font-medium ${c.mono ? 'font-mono' : ''}`} style={{ color: 'var(--g)' }}>{c.v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Характеристики — span 3 */}
          <div className="lg:col-span-3" style={{ ...cell, padding: '15px 17px' }}>
            <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--slate)' }}>Характеристики</p>
            <dl className="divide-y" style={{ borderColor: 'var(--fog)' }}>
              {specs.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1.5">
                  <dt className="text-[13.5px]" style={{ color: 'var(--slate)' }}>{s.k}</dt>
                  <dd className={`text-[13.5px] font-medium text-right ${s.mono ? 'font-mono' : ''}`} style={{ color: 'var(--g)' }}>{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Состояние + донор — span 3 */}
          <div className="lg:col-span-3" style={{ ...cell, padding: '15px 17px' }}>
            <p className="text-xs font-medium mb-2.5 flex items-center gap-1.5" style={{ color: 'var(--slate)' }}>
              <Car className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" /> Состояние и донор
            </p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium px-2 h-6 inline-flex items-center rounded-md" style={{ background: condTone.bg, color: condTone.text }}>{conditionLabel}</span>
            </div>
            {part.vehicle ? (
              <div className="rounded-[11px] p-3" style={{ background: 'var(--inset)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--g)' }}>{vehicleStr}</p>
                {part.vehicle.vin && <p className="text-[11px] font-mono mt-1 select-all" style={{ color: 'var(--muted)' }}>VIN: {part.vehicle.vin}</p>}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Данные о доноре не указаны</p>
            )}
          </div>

          {/* Продавец — span 4 */}
          <div className="lg:col-span-4 min-w-0">
            <SellerContactCard
              company={part.company}
              hideCallButton
              telegramMessage={
                `Здравствуйте! Интересует запчасть:\n«${part.name}»` +
                (vehicleStr ? `\nАвто: ${vehicleStr}` : '') +
                (part.partNumber ? `\nОриг. номер: ${part.partNumber.toUpperCase()}` : '') +
                `\n${typeof window !== 'undefined' ? window.location.href : ''}`
              }
            />
          </div>

          {/* Локация / доставка — span 2 */}
          <div className="lg:col-span-2" style={{ ...cell, padding: '15px 17px' }}>
            <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--slate)' }}>Доставка</p>
            <div className="flex items-start gap-2.5">
              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent-on-soft)' }}>
                <MapPin className="w-4.5 h-4.5" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--g)' }}>Новой Почтой</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Уточните у продавца сроки и условия</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Описание */}
      {part.description && (
        <div className="mt-3 p-4 max-w-3xl rounded-2xl" style={cell}>
          <h2 className="flex items-center gap-1.5 text-xs font-medium mb-2.5" style={{ color: 'var(--slate)' }}>
            <FileText className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" /> Описание
          </h2>
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--steel)' }}>{part.description}</p>
        </div>
      )}

      {/* Похожее */}
      {related.length > 0 && (
        <section className="mt-8 sm:mt-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="mk-title">Ещё от этой разборки</h2>
            <Link to={`/market/supplier/${part.company.id}`} className="text-sm inline-flex items-center gap-1 min-h-[44px] font-medium" style={{ color: 'var(--accent)' }}>
              Все товары <ChevronRight className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          <div className="mk-grid">{related.map(p => <MarketProductCard key={p.id} part={p} />)}</div>
        </section>
      )}
    </div>
  )
}

export { MarketProductPage }
