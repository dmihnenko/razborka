import { useState } from 'react'
import { Package, ImageIcon, Trash2, Car, Edit2, ShoppingCart, CheckSquare, Square, Share2 } from 'lucide-react'
import ShareModal from '@/components/ui/ShareModal'
import type { PartsInventoryItem, PartsInventoryStatus } from '@/types/parts'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PartsInventoryStatus, { label: string; className: string }> = {
  available: { label: 'В наличии', className: 'badge badge-green' },
  reserved:  { label: 'Резерв',    className: 'badge badge-yellow' },
  sold:      { label: 'Продано',   className: 'badge badge-gray' },
  damaged:   { label: 'Брак',      className: 'badge badge-red' },
}

// ── Props ────────────────────────────────────────────────────────────────────

interface InventoryCardProps {
  item: PartsInventoryItem
  statusFilter?: string
  selectedIds?: Set<string>
  onStatusClick: (item: PartsInventoryItem, e: React.MouseEvent) => void
  onEdit: (item: PartsInventoryItem, e: React.MouseEvent) => void
  onSell: (item: PartsInventoryItem, e: React.MouseEvent) => void
  onDelete: (item: PartsInventoryItem, e: React.MouseEvent) => void
  onNavigate: (id: string) => void
  onToggleSelect?: (id: string, e: React.MouseEvent) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function InventoryCard({
  item,
  statusFilter: _statusFilter,
  selectedIds,
  onStatusClick,
  onEdit,
  onSell,
  onDelete,
  onNavigate,
  onToggleSelect,
}: InventoryCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // Photo helpers
  const photos = item.photos ?? []
  const hasPhotos = photos.length > 0 && !imgError
  const primaryPhoto = photos[0]?.thumb_url || photos[0]?.url
  const photoCount = photos.length

  // Status
  const statusCfg = STATUS_CONFIG[item.status] ?? {
    label: item.status,
    className: 'badge badge-gray',
  }

  // Condition
  const conditionLabel = PARTS_CONDITION_LABELS[item.condition] ?? item.condition

  // Vehicle string
  const vehicle = item.vehicle
    ? `${item.vehicle.make} ${item.vehicle.model}${item.vehicle.year ? ` ${item.vehicle.year}` : ''}`.trim()
    : null

  // Price display
  const currency = item.price_currency ?? 'UAH'
  const isSold = item.status === 'sold'
  const priceDisplay = isSold && item.sold_price != null
    ? formatPrice(item.sold_price, currency)
    : item.selling_price != null
      ? formatPrice(item.selling_price, currency)
      : null

  // Selection state
  const isSelected = selectedIds?.has(item.id) ?? false
  const selectable = !!onToggleSelect

  // Low stock indicator (not from vehicle, quantity low, available)
  const lowStock = !item.vehicle_id && item.quantity <= 2 && item.status === 'available'

  // Поделиться публичной ссылкой на запчасть — через единую форму
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShareOpen(true)
  }
  const shareUrl = `${window.location.origin}/public/parts-item/${item.id}`
  const shareText = [item.name, vehicle, priceDisplay].filter(Boolean).join(' · ')

  return (
    <div
      className={[
        'cab-card cab-card-hover flex flex-col overflow-hidden p-0',
        isSelected ? 'ring-2' : '',
      ].join(' ')}
      style={isSelected ? { borderColor: 'var(--cab-ink)', boxShadow: '0 0 0 1px var(--cab-ink)' } : undefined}
    >
      {/* ── ФОТО БЛОК ───────────────────────────────────────────────────── */}
      <div
        className="relative aspect-[4/3] bg-gray-100 overflow-hidden cursor-pointer flex-shrink-0"
        onClick={() => onNavigate(item.id)}
      >
        {hasPhotos ? (
          <>
            {/* Skeleton пока грузится */}
            {!imgLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse" />
            )}
            <img
              src={primaryPhoto}
              alt={item.name}
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={[
                'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
                imgLoaded ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            />
          </>
        ) : (
          /* Placeholder */
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-50">
            <Package className="w-12 h-12 text-gray-300" strokeWidth={1.5} />
            <span className="text-xs text-gray-400">Нет фото</span>
          </div>
        )}

        {/* Статус-бейдж — absolute top-left */}
        <button
          onClick={(e) => { e.stopPropagation(); onStatusClick(item, e) }}
          className={[
            'absolute top-2 left-2 shadow-sm backdrop-blur-sm hover:opacity-85 transition-opacity',
            statusCfg.className,
          ].join(' ')}
        >
          {statusCfg.label}
        </button>

        {/* Счётчик фото — absolute bottom-right */}
        {photoCount > 1 && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md backdrop-blur-sm pointer-events-none">
            <ImageIcon className="w-3 h-3" />
            {photoCount}
          </span>
        )}

        {/* Мало в наличии — absolute bottom-left */}
        {lowStock && (
          <span className="absolute bottom-2 left-2 badge badge-red pointer-events-none">
            Мало
          </span>
        )}

        {/* Действия — absolute top-right */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            onClick={handleShare}
            className="btn-icon-sm bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
            aria-label="Поделиться"
            title="Поделиться"
          >
            <Share2 className="w-3.5 h-3.5 drop-shadow" />
          </button>
          {selectable && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect!(item.id, e) }}
              className="p-0.5 rounded transition-opacity hover:opacity-90"
              aria-label={isSelected ? 'Снять выбор' : 'Выбрать'}
            >
              {isSelected
                ? <CheckSquare className="w-5 h-5 text-white drop-shadow" />
                : <Square className="w-5 h-5 text-white/80 drop-shadow" />
              }
            </button>
          )}
        </div>
      </div>

      {/* ── КОНТЕНТ ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col flex-1 px-3 pt-3 pb-2 gap-1.5 cursor-pointer"
        onClick={() => onNavigate(item.id)}
      >
        {/* Категория */}
        {item.category?.name && (
          <span className="kicker text-gray-400">
            {item.category.name}
          </span>
        )}

        {/* Название */}
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 hover:text-primary transition-colors">
          {item.name}
        </h3>

        {/* Артикул + Состояние */}
        <div className="flex items-center gap-2 flex-wrap">
          {item.part_number && (
            <span className="kicker text-gray-400">
              {item.part_number}
            </span>
          )}
          {item.condition && (
            <span className="text-[10px] text-gray-400">
              {conditionLabel}
            </span>
          )}
        </div>

        {/* Авто */}
        {vehicle && (
          <div className="flex items-center gap-1 text-xs text-gray-500 truncate">
            <Car className="w-3 h-3 shrink-0 text-gray-400" />
            <span className="truncate">{vehicle}</span>
          </div>
        )}

        {/* Кол-во + Место */}
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
          <span
            className={[
              'kicker px-1.5 py-0.5 rounded-md tabular',
              lowStock ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600',
            ].join(' ')}
          >
            {item.quantity ?? 1} шт.
          </span>
          {item.location && (
            <span className="text-[10px] text-gray-400 truncate">
              {item.location}
            </span>
          )}
        </div>

        {/* Цена */}
        <div className="mt-auto pt-1.5">
          {isSold && item.sold_price != null ? (
            <div>
              <p className="text-[10px] text-gray-400 leading-none mb-0.5">Продано за</p>
              <p className="text-base font-bold text-gray-500 tabular">{priceDisplay}</p>
            </div>
          ) : priceDisplay ? (
            <p className="text-lg font-bold text-primary leading-tight tabular">{priceDisplay}</p>
          ) : (
            <p className="text-xs text-amber-600 font-medium">Цена не указана</p>
          )}
        </div>
      </div>

      {/* ── КНОПКИ ──────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1.5 px-3 pt-2 pb-3 border-t border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Изменить */}
        <button
          onClick={(e) => onEdit(item, e)}
          className="cab-btn cab-btn-secondary cab-btn-sm flex-1 gap-1"
        >
          <Edit2 className="w-3.5 h-3.5" />
          Изменить
        </button>

        {/* Продать */}
        <button
          onClick={(e) => onSell(item, e)}
          disabled={isSold}
          className="cab-btn cab-btn-success cab-btn-sm flex-1 gap-1"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Продать
        </button>

        {/* Удалить */}
        <button
          onClick={(e) => onDelete(item, e)}
          aria-label="Удалить"
          className="btn-icon-sm text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {shareOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <ShareModal
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            url={shareUrl}
            title="Поделиться запчастью"
            subtitle="Ссылка открывает карточку запчасти"
            shareTitle={item.name}
            shareText={shareText}
          />
        </div>
      )}
    </div>
  )
}

export default InventoryCard
