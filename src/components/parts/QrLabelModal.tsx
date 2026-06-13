import { useEffect, useState } from 'react'
import { QrCode, Printer, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useBlockScroll } from '@/hooks/useBlockScroll'

interface Props {
  title: string
  subtitle?: string
  /** Текст/URL, который кодируется в QR */
  value: string
  onClose: () => void
}

/**
 * Модалка печати QR-этикетки.
 * Этикетка всегда светлая (принудительный white bg / black text),
 * обёрнута в .print-area — @media print в index.css печатает только её.
 */
export default function QrLabelModal({ title, subtitle, value, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [qrError, setQrError]     = useState(false)

  useBlockScroll(true)

  /* Генерируем QR при монтировании / смене value */
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(url => { if (!cancelled) setQrDataUrl(url) })
      .catch(() => { if (!cancelled) setQrError(true) })
    return () => { cancelled = true }
  }, [value])

  /* Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    /* Оверлей */
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 backdrop-blur-[2px] px-3 py-3 sm:p-4 animate-fade-in"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      onClick={onClose}
    >
      {/* Панель */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Печать QR-этикетки"
        onClick={e => e.stopPropagation()}
        className="relative bg-white w-full sm:max-w-sm rounded-2xl shadow-2xl
          max-h-[calc(100dvh-1.5rem)] sm:max-h-[92dvh] flex flex-col overflow-hidden animate-slide-down sm:animate-modal-pop"
      >
        {/* Шапка */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 flex-shrink-0 no-print">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 leading-tight truncate">QR-этикетка</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">Печать наклейки</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Тело */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 flex flex-col items-center gap-5">

          {/* ── Этикетка — единственное, что уходит в печать ── */}
          <div
            className="print-area"
            style={{
              width: 280,
              background: '#fff',
              color: '#000',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '16px 16px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-sans, sans-serif)',
            }}
          >
            {/* QR */}
            {qrError ? (
              <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 6 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Ошибка QR</span>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR-код"
                style={{ width: 180, height: 180, display: 'block', imageRendering: 'pixelated' }}
              />
            ) : (
              <div style={{ width: 180, height: 180, background: '#f3f4f6', borderRadius: 6 }} />
            )}

            {/* Название */}
            <p style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: '#111827',
              textAlign: 'center',
              lineHeight: 1.3,
              wordBreak: 'break-word',
              maxWidth: 240,
            }}>
              {title}
            </p>

            {/* Артикул / путь */}
            {subtitle && (
              <p style={{
                margin: 0,
                fontSize: 11,
                color: '#6b7280',
                textAlign: 'center',
                lineHeight: 1.4,
                wordBreak: 'break-word',
                maxWidth: 240,
              }}>
                {subtitle}
              </p>
            )}

            {/* Value моноширинно */}
            <p style={{
              margin: 0,
              fontSize: 9,
              fontFamily: 'var(--font-mono, monospace)',
              color: '#9ca3af',
              textAlign: 'center',
              wordBreak: 'break-all',
              maxWidth: 240,
            }}>
              {value}
            </p>
          </div>

          {/* Подсказка */}
          <p className="text-xs text-gray-400 text-center no-print">
            Нажмите «Печать» для вывода на принтер или сохранения в PDF
          </p>
        </div>

        {/* Футер — кнопки */}
        <div
          className="flex-shrink-0 border-t border-gray-100 px-5 py-3.5 bg-white flex gap-3 no-print"
          style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!qrDataUrl && !qrError}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Печать
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary flex items-center justify-center gap-2 px-5"
          >
            <X className="w-4 h-4" />
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
