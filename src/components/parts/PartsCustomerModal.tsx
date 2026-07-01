import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { PartsCustomer, CreatePartsCustomerInput } from '@/types/parts'
import { useBlockScroll } from '@/hooks/useBlockScroll'

interface PartsCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreatePartsCustomerInput) => Promise<unknown>
  customer?: PartsCustomer | null
}

export default function PartsCustomerModal({ isOpen, onClose, onSubmit, customer }: PartsCustomerModalProps) {
  const { t } = useTranslation('cabinet')
  const [formData, setFormData] = useState<CreatePartsCustomerInput>({
    full_name: customer?.full_name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    notes: customer?.notes || '',
    discount_percent: customer?.discount_percent || 0
  })
  const [loading, setLoading] = useState(false)

  useBlockScroll(isOpen)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'discount_percent' ? Math.max(0, Math.min(100, Number(value))) : value
    }))
  }

  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        {/* Handle */}
        <div className="modal-handle" />

        {/* Header */}
        <div className="modal-header">
          <h2 className="text-base font-bold text-gray-900">
            {customer ? t('customerModal.titleEdit') : t('customerModal.titleAdd')}
          </h2>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
            aria-label={t('customerModal.close')}>
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="modal-body space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {t('customerModal.fullName')} <span className="text-red-500 normal-case font-normal">*</span>
              </label>
              <input type="text" name="full_name" value={formData.full_name}
                onChange={handleChange} required autoComplete="off"
                placeholder={t('customerModal.fullNamePlaceholder')}
                className="modal-input" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('customerModal.phone')}</label>
              <input type="tel" name="phone" value={formData.phone || ''}
                onChange={handleChange}
                placeholder="+380 XX XXX-XX-XX"
                className="modal-input" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('customerModal.email')}</label>
              <input type="email" name="email" value={formData.email || ''}
                onChange={handleChange}
                placeholder="client@example.com"
                className="modal-input" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('customerModal.discount')}</label>
              <input type="number" name="discount_percent" value={formData.discount_percent}
                onChange={handleChange} min="0" max="100"
                className="modal-input" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('customerModal.notes')}</label>
              <textarea name="notes" value={formData.notes || ''} onChange={handleChange}
                rows={3} placeholder={t('customerModal.notesPlaceholder')}
                className="modal-input resize-none" />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer flex gap-3">
            <button type="button" onClick={onClose} className="cab-btn cab-btn-secondary flex-1">
              {t('customerModal.cancel')}
            </button>
            <button type="submit" disabled={loading || !formData.full_name.trim()} className="cab-btn cab-btn-primary flex-1">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('customerModal.saving')}
                </span>
              ) : customer ? t('customerModal.save') : t('customerModal.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
