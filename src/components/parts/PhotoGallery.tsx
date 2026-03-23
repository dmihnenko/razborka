import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import type { ImgbbPhoto } from '@/services/imgbbService'

interface PhotoGalleryProps {
  photos: ImgbbPhoto[]
  alt?: string
  /** Main image aspect ratio class. Default: "aspect-video" */
  mainAspect?: string
}

export default function PhotoGallery({ photos, alt = 'Фото', mainAspect = 'aspect-video' }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Touch swipe state
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const lbTouchStartX = useRef<number | null>(null)
  const lbTouchStartY = useRef<number | null>(null)

  const isOpen = lightboxIndex !== null

  // ── helpers ──────────────────────────────────────────────────────────────

  const prev = useCallback((src: 'gallery' | 'lightbox' = 'gallery') => {
    if (src === 'lightbox') {
      setLightboxIndex(i => (i !== null ? (i - 1 + photos.length) % photos.length : 0))
      setActiveIndex(i => (i - 1 + photos.length) % photos.length)
    } else {
      setActiveIndex(i => (i - 1 + photos.length) % photos.length)
    }
  }, [photos.length])

  const next = useCallback((src: 'gallery' | 'lightbox' = 'gallery') => {
    if (src === 'lightbox') {
      setLightboxIndex(i => (i !== null ? (i + 1) % photos.length : 0))
      setActiveIndex(i => (i + 1) % photos.length)
    } else {
      setActiveIndex(i => (i + 1) % photos.length)
    }
  }, [photos.length])

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setActiveIndex(index)
  }

  const closeLightbox = () => setLightboxIndex(null)

  const jumpTo = (index: number) => {
    setActiveIndex(index)
    if (lightboxIndex !== null) setLightboxIndex(index)
  }

  // ── keyboard navigation ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prev('lightbox') }
      if (e.key === 'ArrowRight') { e.preventDefault(); next('lightbox') }
      if (e.key === 'Escape')     closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, prev, next])

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ── thumbnail strip (хуки до раннего возврата)
  const thumbRef = useRef<HTMLDivElement>(null)
  const lbThumbRef = useRef<HTMLDivElement>(null)

  // Auto-scroll active thumb into view
  useEffect(() => {
    const el = thumbRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeIndex])

  useEffect(() => {
    if (lightboxIndex === null) return
    const el = lbThumbRef.current?.children[lightboxIndex] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [lightboxIndex])

  if (photos.length === 0) return null

  // ── gallery swipe handlers ────────────────────────────────────────────────

  const onGalleryTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const onGalleryTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current ?? 0))
    if (Math.abs(dx) > 40 && dy < 60) {
      if (dx < 0) next('gallery')
      else prev('gallery')
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  // ── lightbox swipe handlers ───────────────────────────────────────────────

  const onLbTouchStart = (e: React.TouchEvent) => {
    lbTouchStartX.current = e.touches[0].clientX
    lbTouchStartY.current = e.touches[0].clientY
  }
  const onLbTouchEnd = (e: React.TouchEvent) => {
    if (lbTouchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - lbTouchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - (lbTouchStartY.current ?? 0))
    if (Math.abs(dx) > 50 && dy < 80) {
      if (dx < 0) next('lightbox')
      else prev('lightbox')
    }
    lbTouchStartX.current = null
    lbTouchStartY.current = null
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Gallery ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">

        {/* Main photo */}
        <div
          className={`relative ${mainAspect} bg-gray-900 cursor-zoom-in select-none`}
          onTouchStart={onGalleryTouchStart}
          onTouchEnd={onGalleryTouchEnd}
          onClick={() => openLightbox(activeIndex)}
        >
          <img
            key={photos[activeIndex].url}
            src={photos[activeIndex].url}
            alt={`${alt} ${activeIndex + 1}`}
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />

          {/* Zoom hint */}
          <div className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 pointer-events-none">
            <ZoomIn className="w-4 h-4" />
          </div>

          {/* Counter badge */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full pointer-events-none">
              {activeIndex + 1} / {photos.length}
            </div>
          )}

          {/* Desktop side arrows inside main photo */}
          {photos.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); prev('gallery') }}
                className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors"
                aria-label="Предыдущее фото"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); next('gallery') }}
                className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors"
                aria-label="Следующее фото"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div
            ref={thumbRef}
            className="flex gap-2 p-2.5 overflow-x-auto scrollbar-hide"
          >
            {photos.map((photo, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className={`
                  flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden
                  border-2 transition-all duration-150
                  ${i === activeIndex
                    ? 'border-primary shadow-md scale-105'
                    : 'border-transparent opacity-70 hover:opacity-100 hover:border-gray-300'}
                `}
                aria-label={`Фото ${i + 1}`}
              >
                <img
                  src={photo.thumb_url || photo.url}
                  alt={`${alt} ${i + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-black/95"
          onTouchStart={onLbTouchStart}
          onTouchEnd={onLbTouchEnd}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <span className="text-white/60 text-sm tabular-nums select-none">
              {lightboxIndex + 1} / {photos.length}
            </span>
            <button
              onClick={closeLightbox}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Image area */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={closeLightbox} />

            {/* Image */}
            <img
              key={photos[lightboxIndex].url}
              src={photos[lightboxIndex].url}
              alt={`${alt} ${lightboxIndex + 1}`}
              className="relative z-10 max-w-full max-h-full object-contain select-none
                         px-14 sm:px-20
                         transition-opacity duration-150"
              draggable={false}
              onClick={e => e.stopPropagation()}
            />

            {/* Prev arrow */}
            {photos.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); prev('lightbox') }}
                className="absolute left-2 sm:left-4 z-20
                           w-10 h-10 sm:w-12 sm:h-12
                           flex items-center justify-center
                           bg-white/10 hover:bg-white/25
                           text-white rounded-full
                           transition-colors duration-150
                           touch-manipulation"
                aria-label="Предыдущее фото"
              >
                <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            )}

            {/* Next arrow */}
            {photos.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); next('lightbox') }}
                className="absolute right-2 sm:right-4 z-20
                           w-10 h-10 sm:w-12 sm:h-12
                           flex items-center justify-center
                           bg-white/10 hover:bg-white/25
                           text-white rounded-full
                           transition-colors duration-150
                           touch-manipulation"
                aria-label="Следующее фото"
              >
                <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            )}
          </div>

          {/* Bottom thumbnail strip */}
          {photos.length > 1 && (
            <div
              ref={lbThumbRef}
              className="flex gap-2 px-3 py-3 overflow-x-auto scrollbar-hide shrink-0 justify-center"
            >
              {photos.map((photo, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(i)}
                  className={`
                    flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14
                    rounded-lg overflow-hidden border-2 transition-all duration-150
                    ${i === lightboxIndex
                      ? 'border-white scale-110 shadow-lg'
                      : 'border-transparent opacity-50 hover:opacity-80'}
                  `}
                  aria-label={`Перейти к фото ${i + 1}`}
                >
                  <img
                    src={photo.thumb_url || photo.url}
                    alt={`${alt} ${i + 1}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
