import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Package, Tag, Hash, FileText, Car, Phone, Mail, MapPin,
  CheckCircle, Clock, AlertTriangle, DollarSign,
  ChevronLeft, ChevronRight, X, Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { PublicBrandHeader } from '@/components/PublicBrandHeader'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'

// ─── status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  available: 'В наличии',
  reserved:  'Зарезервировано',
  sold:      'Продано',
  damaged:   'Повреждено',
}

const STATUS_CLS: Record<string, string> = {
  available: 'bg-green-100 text-green-800 border-green-200',
  reserved:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  sold:      'bg-gray-100 text-gray-500 border-gray-200',
  damaged:   'bg-red-100 text-red-800 border-red-200',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  available: <CheckCircle className="w-3.5 h-3.5" />,
  reserved:  <Clock className="w-3.5 h-3.5" />,
  sold:      <DollarSign className="w-3.5 h-3.5" />,
  damaged:   <AlertTriangle className="w-3.5 h-3.5" />,
}

function cleanPhone(p: string) {
  return p.replace(/[^\d+]/g, '')
}

// ─── WhatsApp icon ─────────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.114 1.524 5.84L.057 23.547a.563.563 0 00.692.692l5.7-1.468A11.963 11.963 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.034-1.384l-.36-.214-3.735.961.982-3.624-.234-.371A9.818 9.818 0 0112 2.182c5.427 0 9.818 4.391 9.818 9.818S17.427 21.818 12 21.818z" />
    </svg>
  )
}

// ─── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ photos, startIdx, onClose }: {
  photos: any[]
  startIdx: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(startIdx)
  const touchX = useRef<number | null>(null)

  const prev = useCallback(() => setIdx(i => (i - 1 + photos.length) % photos.length), [photos.length])
  const next = useCallback(() => setIdx(i => (i + 1) % photos.length), [photos.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose, prev, next])

  const photo = photos[idx]
  const src = photo?.url || photo?.display_url || (typeof photo === 'string' ? photo : '')
  const thumb = (p: any) => p?.thumb_url || p?.url || p?.display_url || (typeof p === 'string' ? p : '')

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (dx < -40) next()
        else if (dx > 40) prev()
        touchX.current = null
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        {photos.length > 1
          ? <span className="text-white/60 text-sm tabular-nums">{idx + 1} / {photos.length}</span>
          : <span />
        }
        <button
          onClick={onClose}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0" onClick={onClose} />
        <img
          key={src}
          src={src}
          alt={`Фото ${idx + 1}`}
          className="relative z-10 max-w-full max-h-full object-contain px-12 sm:px-16"
          draggable={false}
          loading="lazy"
          decoding="async"
          onClick={e => e.stopPropagation()}
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              className="absolute left-2 z-20 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/25 text-white rounded-lg transition-colors"
              aria-label="Предыдущее"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); next() }}
              className="absolute right-2 z-20 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/25 text-white rounded-lg transition-colors"
              aria-label="Следующее"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex gap-2 px-3 py-3 overflow-x-auto justify-center flex-shrink-0">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === idx ? 'border-white' : 'border-transparent opacity-50 hover:opacity-75'
              }`}
            >
              <img src={thumb(p)} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PublicPartsItemView() {
  const { id } = useParams<{ id: string }>()
  const [activePhoto, setActivePhoto] = useState(0)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const touchX = useRef<number | null>(null)

  const { data: item, isLoading } = useQuery({
    queryKey: ['public-parts-item', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_inventory')
        .select('*, category:parts_categories(id,name), vehicle:parts_vehicles!vehicle_id(id,make,model,year,vin)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 60_000,
  })

  const { data: company } = useQuery({
    queryKey: ['public-parts-company', item?.parts_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_companies')
        .select('id, name, phone, address, email, description')
        .eq('id', item!.parts_company_id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!item?.parts_company_id,
    staleTime: 5 * 60_000,
  })

  const photos   = (item?.photos as any[]) || []
  const currency = (item?.price_currency as 'UAH' | 'USD') || 'UAH'
  const isSold   = item?.status === 'sold'
  const phoneRaw = company?.phone ? cleanPhone(company.phone) : null

  const getUrl   = (p: any) => p?.url || p?.display_url || (typeof p === 'string' ? p : '')
  const getThumb = (p: any) => p?.thumb_url || getUrl(p)

  const prevPhoto = useCallback(
    () => setActivePhoto(i => (i - 1 + photos.length) % photos.length),
    [photos.length],
  )
  const nextPhoto = useCallback(
    () => setActivePhoto(i => (i + 1) % photos.length),
    [photos.length],
  )

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <Spinner size="xl" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-gray-50">
        <Package className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 font-medium">Запчасть не найдена</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-8">

      <PublicBrandHeader subtitle={company?.name || 'Авторазборка'} />

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">

        {/*
          DESKTOP: grid [фото | инфо-панель sticky 360px]
          MOBILE:  одна колонка
        */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-5 items-start">

          {/* ══ ЛЕВАЯ КОЛОНКА: Фото ══════════════════════════════════════ */}
          <div className="space-y-3">

            {/* Photo block */}
            {photos.length > 0 ? (
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                {/* Main photo */}
                <div
                  className="relative aspect-[4/3] sm:aspect-[16/10] bg-gray-100 cursor-zoom-in select-none overflow-hidden"
                  onClick={() => setLightboxIdx(activePhoto)}
                  onTouchStart={e => { touchX.current = e.touches[0].clientX }}
                  onTouchEnd={e => {
                    if (touchX.current === null) return
                    const dx = e.changedTouches[0].clientX - touchX.current
                    if (dx < -40) nextPhoto()
                    else if (dx > 40) prevPhoto()
                    touchX.current = null
                  }}
                >
                  <img
                    key={getUrl(photos[activePhoto])}
                    src={getUrl(photos[activePhoto])}
                    alt={item.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  {photos.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-md pointer-events-none">
                      {activePhoto + 1} / {photos.length}
                    </div>
                  )}
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); prevPhoto() }}
                        className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
                        aria-label="Предыдущее фото"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); nextPhoto() }}
                        className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
                        aria-label="Следующее фото"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails */}
                {photos.length > 1 && (
                  <div className="flex gap-1.5 p-2 overflow-x-auto">
                    {photos.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setActivePhoto(i)}
                        className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                          i === activePhoto
                            ? 'border-primary'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        aria-label={`Фото ${i + 1}`}
                      >
                        <img
                          src={getThumb(p)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm aspect-[4/3] flex items-center justify-center text-gray-300">
                <Package className="w-16 h-16" />
              </div>
            )}

            {/* Description — desktop only (under photo) */}
            {item.description && (
              <div className="hidden lg:block bg-white rounded-xl shadow-sm p-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Описание
                </h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {item.description}
                </p>
              </div>
            )}

            {/* Notes — desktop only */}
            {item.notes && (
              <div className="hidden lg:block bg-white rounded-xl shadow-sm p-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Примечания
                </h2>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed italic">
                  {item.notes}
                </p>
              </div>
            )}
          </div>

          {/* ══ ПРАВАЯ КОЛОНКА: инфо-панель (sticky на десктопе) ════════ */}
          <div className="lg:sticky lg:top-4 space-y-3">

            {/* ── Карточка: название + цена + статус ─────────────────── */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">

              {/* Badges row: статус + категория + состояние */}
              <div className="flex flex-wrap gap-1.5 mb-3">

                <span className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1
                  rounded-md text-xs font-semibold border
                  ${STATUS_CLS[item.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}
                `}>
                  {STATUS_ICON[item.status]}
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>

                {item.category && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    <Tag className="w-3 h-3" />
                    {item.category.name}
                  </span>
                )}

                {item.condition && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                    {PARTS_CONDITION_LABELS[item.condition] || item.condition}
                  </span>
                )}
              </div>

              {/* Название */}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight mb-1">
                {item.name}
              </h1>

              {/* Оригинальный номер */}
              {item.part_number && (
                <div className="mb-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1">Оригинальный номер</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(item.part_number!.toUpperCase())
                      toast.success('Номер скопирован')
                    }}
                    title="Нажмите, чтобы скопировать"
                    className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border-2 border-primary/25 shadow-md hover:border-primary/50 hover:shadow-lg active:scale-95 transition-all"
                  >
                    <Hash className="w-3.5 h-3.5 text-primary" />
                    <span className="font-mono font-bold tracking-wider text-gray-800 uppercase">
                      {item.part_number.toUpperCase()}
                    </span>
                    <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary transition-colors" />
                  </button>
                </div>
              )}

              {/* Цена */}
              <div className="mt-3 p-3.5 rounded-xl bg-primary/5 border border-primary/15">
                {isSold ? (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">Продано за</p>
                    <p className="text-2xl font-bold text-gray-500 line-through decoration-red-400">
                      {item.sold_price ? formatPrice(item.sold_price, currency) : '—'}
                    </p>
                    <p className="text-xs text-red-500 font-medium mt-0.5">Товар продан</p>
                  </>
                ) : item.selling_price ? (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">Цена</p>
                    <p className="text-3xl font-bold text-primary leading-none">
                      {formatPrice(item.selling_price, currency)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">Цена по запросу</p>
                )}
              </div>

              {/* CTA кнопки — первый экран */}
              {phoneRaw && !isSold && (
                <div className="flex gap-2 mt-3">
                  <a
                    href={`tel:${phoneRaw}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
                  >
                    <Phone className="w-4 h-4" />
                    Позвонить
                  </a>
                  <a
                    href={`https://wa.me/${phoneRaw.replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 active:scale-[0.98] transition-all duration-150"
                  >
                    <WhatsAppIcon className="w-4 h-4 fill-current" />
                    WhatsApp
                  </a>
                </div>
              )}
            </div>

            {/* ── Карточка: автомобиль ──────────────────────────────── */}
            {item.vehicle && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" />
                  Снята с автомобиля
                </h2>
                <p className="text-base font-bold text-gray-900">
                  {item.vehicle.make} {item.vehicle.model}
                  {item.vehicle.year && (
                    <span className="font-normal text-gray-500 ml-1">{item.vehicle.year} г.</span>
                  )}
                </p>
                {item.vehicle.vin && (
                  <p className="text-[11px] font-mono text-gray-400 mt-0.5 select-all">
                    VIN: {item.vehicle.vin}
                  </p>
                )}
              </div>
            )}

            {/* ── Количество (только если > 1) ─────────────────────── */}
            {item.quantity > 1 && (
              <div className="bg-white rounded-xl shadow-sm px-4 py-3">
                <dl className="flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Кол-во</dt>
                    <dd className="text-sm font-bold text-gray-900">{item.quantity} шт.</dd>
                  </div>
                </dl>
              </div>
            )}

            {/* ── Контакты компании ─────────────────────────────────── */}
            {company && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">

                {/* Шапка компании */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Продавец</p>
                  <p className="text-base font-bold text-gray-900">{company.name}</p>
                  {company.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                      {company.description}
                    </p>
                  )}
                </div>

                {/* Контакты — кликабельные строки */}
                <div className="divide-y divide-gray-50">

                  {company.phone && (
                    <a
                      href={`tel:${phoneRaw}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium leading-none mb-0.5">Телефон</p>
                        <p className="text-sm font-semibold text-gray-900">{company.phone}</p>
                      </div>
                    </a>
                  )}

                  {company.email && (
                    <a
                      href={`mailto:${company.email}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium leading-none mb-0.5">Email</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{company.email}</p>
                      </div>
                    </a>
                  )}

                  {company.address && (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium leading-none mb-0.5">Адрес</p>
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{company.address}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* CTA кнопки внизу блока контактов */}
                {phoneRaw && (
                  <div className="flex gap-2 p-3 bg-gray-50 border-t border-gray-100">
                    <a
                      href={`tel:${phoneRaw}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
                    >
                      <Phone className="w-4 h-4" />
                      Позвонить
                    </a>
                    <a
                      href={`https://wa.me/${phoneRaw.replace('+', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 active:scale-[0.98] transition-all duration-150"
                    >
                      <WhatsAppIcon className="w-4 h-4 fill-current" />
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Описание + Примечания (mobile only, под гридом) ────────── */}
        {item.description && (
          <div className="lg:hidden mt-4 bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Описание
            </h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {item.description}
            </p>
          </div>
        )}

        {item.notes && (
          <div className="lg:hidden mt-3 bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Примечания
            </h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed italic">
              {item.notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 mt-6">
          Страница сгенерирована автоматически · TSP CRM
        </p>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          startIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  )
}
