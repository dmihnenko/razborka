import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { X, Plus, Trash2, ScanLine, Pencil } from 'lucide-react'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import type { PartsVehicle, CreatePartsVehicleInput } from '@/types/parts'
import { formatCurrency } from '@/utils/currency'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useBlockScroll } from '@/hooks/useBlockScroll'
import { decodeVin } from '@/services/vinService'
import { getMarketCarCatalog, suggestCarModel } from '@/services/marketplaceService'
import { Spinner } from '@/components/ui/Spinner'

const OTHER = '__other__'

interface PriceRow {
  id: number
  label: string
  amount: string
  currency: 'USD' | 'UAH'
}

let rowCounter = 1
function newRow(partial?: Partial<PriceRow>): PriceRow {
  return { id: rowCounter++, label: '', amount: '', currency: 'USD', ...partial }
}

function calcTotals(rows: PriceRow[], rate: number) {
  let totalUSD = 0
  let totalUAH = 0
  for (const row of rows) {
    const amt = parseFloat(row.amount) || 0
    if (row.currency === 'USD') {
      totalUSD += amt
      totalUAH += amt * rate
    } else {
      totalUAH += amt
      totalUSD += amt / rate
    }
  }
  return { totalUSD, totalUAH }
}

interface PartsVehicleModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreatePartsVehicleInput) => Promise<void>
  vehicle?: PartsVehicle | null
}

export default function PartsVehicleModal({ isOpen, onClose, onSubmit, vehicle }: PartsVehicleModalProps) {
  const { t } = useTranslation('cabinet')
  const { rate: globalRate } = usePartsExchangeRate()
  useBlockScroll(isOpen)
  const [formData, setFormData] = useState<CreatePartsVehicleInput>({
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    year: vehicle?.year,
    vin: vehicle?.vin || '',
    color: vehicle?.color || '',
    mileage: vehicle?.mileage,
    notes: vehicle?.notes || ''
  })

  // Initialize price rows from existing vehicle data
  const [priceRows, setPriceRows] = useState<PriceRow[]>(() => {
    if (vehicle?.purchase_price && vehicle.purchase_price > 0) {
      const rate = vehicle.exchange_rate || globalRate || 41
      // stored as UAH — show as one USD row if divisible nicely, else UAH
      const asUSD = vehicle.purchase_price / rate
      const rounded = Math.round(asUSD)
      const isCleanUSD = Math.abs(rounded - asUSD) < 0.5
      return [newRow({ amount: isCleanUSD ? String(rounded) : String(vehicle.purchase_price), currency: isCleanUSD ? 'USD' : 'UAH' })]
    }
    return [newRow()]
  })

  const [exchangeRate, setExchangeRate] = useState<number>(vehicle?.exchange_rate || globalRate || 41)
  const [loading, setLoading] = useState(false)
  const [vinLoading, setVinLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Каталог авто: выбор марки/модели из справочника либо ручной ввод ───────
  const { data: profile } = useUserProfile()
  const { data: carCatalog = [] } = useQuery({ queryKey: ['market-car-catalog'], queryFn: getMarketCarCatalog, staleTime: 5 * 60_000 })

  const [manualMake, setManualMake] = useState(false)   // ручной ввод марки + модели
  const [manualModel, setManualModel] = useState(false) // марка из каталога, модель вручную
  const initRef = useRef(false)

  const makeFacet = carCatalog.find(c => c.make.toLowerCase() === (formData.make || '').toLowerCase())
  const catalogModels = makeFacet?.models ?? []

  // При редактировании: если марки/модели нет в каталоге — открыть ручной ввод
  useEffect(() => {
    if (initRef.current || carCatalog.length === 0) return
    initRef.current = true
    const mk = (formData.make || '').trim()
    if (!mk) return
    const facet = carCatalog.find(c => c.make.toLowerCase() === mk.toLowerCase())
    if (!facet) { setManualMake(true); return }
    const md = (formData.model || '').trim()
    if (md && !facet.models.some(m => m.model.toLowerCase() === md.toLowerCase())) setManualModel(true)
  }, [carCatalog, formData.make, formData.model])

  const onMakeSelect = (val: string) => {
    if (val === OTHER) { setManualMake(true); setManualModel(false); setFormData(prev => ({ ...prev, make: '', model: '' })); return }
    setManualMake(false); setManualModel(false)
    setFormData(prev => ({ ...prev, make: val, model: '' }))
  }
  const onModelSelect = (val: string) => {
    if (val === OTHER) { setManualModel(true); setFormData(prev => ({ ...prev, model: '' })); return }
    setManualModel(false)
    setFormData(prev => ({ ...prev, model: val }))
  }
  const backToCatalog = () => {
    setManualMake(false); setManualModel(false)
    setFormData(prev => ({ ...prev, make: '', model: '' }))
  }

  // Пара марка+модель отсутствует в утверждённом каталоге → нужна заявка админу
  const isPairNew = () => {
    const mk = (formData.make || '').trim().toLowerCase()
    const md = (formData.model || '').trim().toLowerCase()
    if (!mk || !md) return false
    const facet = carCatalog.find(c => c.make.toLowerCase() === mk)
    return !facet || !facet.models.some(m => m.model.toLowerCase() === md)
  }

  const { totalUSD, totalUAH } = calcTotals(priceRows, exchangeRate)

  if (!isOpen) return null

  const handleDecodeVin = async () => {
    const vin = (formData.vin || '').trim()
    if (!vin) return
    setVinLoading(true)
    try {
      const result = await decodeVin(vin)
      if (!result.make && !result.model && !result.year && !result.engine) {
        toast.info(t('vehicleModal.toastVinFailed'))
        return
      }
      const nextMake = formData.make || result.make || ''
      const nextModel = formData.model || result.model || ''
      setFormData(prev => ({
        ...prev,
        make: prev.make || result.make || prev.make,
        model: prev.model || result.model || prev.model,
        year: prev.year || result.year || prev.year,
      }))
      // Распознанные марка/модель могут быть вне каталога — включаем ручной режим
      if (nextMake) {
        const facet = carCatalog.find(c => c.make.toLowerCase() === nextMake.toLowerCase())
        if (!facet) setManualMake(true)
        else if (nextModel && !facet.models.some(m => m.model.toLowerCase() === nextModel.toLowerCase())) setManualModel(true)
      }
      toast.success(t('vehicleModal.toastVinFilled'))
    } catch {
      toast.error(t('vehicleModal.toastVinUnavailable'))
    } finally {
      setVinLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // Убираем undefined значения перед отправкой
      const cleanData: CreatePartsVehicleInput = {
        make: formData.make,
        model: formData.model,
        ...(formData.year && { year: formData.year }),
        ...(formData.vin && { vin: formData.vin }),
        ...(formData.color && { color: formData.color }),
        ...(formData.mileage && { mileage: formData.mileage }),
        ...(totalUAH > 0 && { purchase_price: totalUAH }),
        exchange_rate: exchangeRate,
        ...(formData.notes && { notes: formData.notes })
      }

      await onSubmit(cleanData)

      // Новые марка/модель — заявка в общий каталог на утверждение админу
      if (isPairNew()) {
        void suggestCarModel(cleanData.make, cleanData.model, profile?.parts_company_id)
        toast.info(t('vehicleModal.toastNewPairSent'))
      }

      onClose()
    } catch (err: any) {
      const msg = err?.message || err?.details || t('vehicleModal.errorSave')
      setError(msg)
      console.error('Error submitting vehicle:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'year' || name === 'mileage')
               ? (value ? parseFloat(value) : undefined)
               : value
    }))
  }

  return (
    <div className="modal-overlay">
      <div className="modal-sheet sm:max-w-2xl">
        <div className="modal-handle" />

        <div className="modal-header">
          <h2 className="heading-3">
            {vehicle ? t('vehicleModal.titleEdit') : t('vehicleModal.titleAdd')}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="btn-icon"
            aria-label={t('vehicleModal.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="parts-vehicle-form" onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="alert alert-danger mb-4">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Марка */}
            <div>
              <label className="form-label">
                {t('vehicleModal.make')} <span className="text-red-500">*</span>
              </label>
              {manualMake || carCatalog.length === 0 ? (
                <input
                  type="text"
                  name="make"
                  value={formData.make}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder={t('vehicleModal.makePlaceholder')}
                />
              ) : (
                <select
                  value={formData.make}
                  onChange={e => onMakeSelect(e.target.value)}
                  required
                  className="form-select"
                >
                  <option value="" disabled>{t('vehicleModal.selectMake')}</option>
                  {carCatalog.map(c => <option key={c.make} value={c.make}>{c.make}</option>)}
                  <option value={OTHER}>{t('vehicleModal.otherMake')}</option>
                </select>
              )}
            </div>

            {/* Модель */}
            <div>
              <label className="form-label">
                {t('vehicleModal.model')} <span className="text-red-500">*</span>
              </label>
              {manualMake || manualModel || carCatalog.length === 0 ? (
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder={t('vehicleModal.modelPlaceholder')}
                />
              ) : (
                <select
                  value={formData.model}
                  onChange={e => onModelSelect(e.target.value)}
                  required
                  disabled={!formData.make}
                  className="form-select disabled:opacity-60"
                >
                  <option value="" disabled>{formData.make ? t('vehicleModal.selectModel') : t('vehicleModal.selectMakeFirst')}</option>
                  {catalogModels.map(m => <option key={m.model} value={m.model}>{m.model}</option>)}
                  <option value={OTHER}>{t('vehicleModal.otherModel')}</option>
                </select>
              )}
            </div>

            {/* Подсказка про ручной ввод (новые марка/модель уходят на утверждение) */}
            {(manualMake || manualModel) && carCatalog.length > 0 && (
              <div className="sm:col-span-2 -mt-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-amber-600 flex items-start gap-1.5">
                    <Pencil className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    {t('vehicleModal.newPairHint')}
                  </p>
                  <button type="button" onClick={backToCatalog} className="text-xs font-medium text-primary hover:underline whitespace-nowrap flex-shrink-0">
                    {t('vehicleModal.chooseFromCatalog')}
                  </button>
                </div>
              </div>
            )}

            {/* Год */}
            <div>
              <label className="form-label">
                {t('vehicleModal.year')}
              </label>
              <IMaskInput
                mask={Number}
                min={1900}
                max={new Date().getFullYear() + 1}
                value={String(formData.year || '')}
                onAccept={(value: string) => setFormData(prev => ({ ...prev, year: value ? Number(value) : undefined }))}
                className="form-input"
                placeholder="2020"
              />
            </div>

            {/* VIN */}
            <div>
              <label className="form-label">
                {t('vehicleModal.vin')}
              </label>
              <div className="flex gap-2">
                <IMaskInput
                  mask={/^[A-HJ-NPR-Z0-9]{0,17}$/i}
                  prepare={(str: string) => str.toUpperCase()}
                  value={formData.vin || ''}
                  onAccept={(value: string) => setFormData(prev => ({ ...prev, vin: value }))}
                  className="form-input min-w-0 flex-1 font-mono tracking-widest"
                  placeholder={t('vehicleModal.vinPlaceholder')}
                />
                <button
                  type="button"
                  onClick={handleDecodeVin}
                  disabled={!formData.vin?.trim() || vinLoading}
                  title={t('vehicleModal.decodeVinTitle')}
                  className="cab-btn cab-btn-secondary flex-shrink-0 flex items-center gap-1.5 px-3"
                >
                  {vinLoading
                    ? <Spinner size="sm" className="w-5 h-5" />
                    : <ScanLine className="w-5 h-5" strokeWidth={1.5} />
                  }
                  <span className="hidden sm:inline">{t('vehicleModal.decode')}</span>
                </button>
              </div>
              {formData.vin && (
                <p className={`text-xs mt-1 ${formData.vin.length === 17 ? 'text-green-600' : 'text-gray-400'}`}>
                  {t('vehicleModal.vinCounter', { count: formData.vin.length })}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">{t('vehicleModal.vinNotice')}</p>
            </div>

            {/* Цвет */}
            <div>
              <label className="form-label">
                {t('vehicleModal.color')}
              </label>
              <input
                type="text"
                name="color"
                value={formData.color || ''}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            {/* Пробег */}
            <div>
              <label className="form-label">
                {t('vehicleModal.mileage')}
              </label>
              <input
                type="number"
                name="mileage"
                value={formData.mileage || ''}
                onChange={handleChange}
                min="0"
                className="form-input"
              />
            </div>

            {/* Цена покупки */}
            {vehicle && (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">{t('vehicleModal.purchasePrice')}</label>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>{t('vehicleModal.rate')}</span>
                    <input
                      type="number"
                      value={exchangeRate}
                      onChange={e => setExchangeRate(Number(e.target.value) || 41)}
                      min="1"
                      className="form-input w-16 px-2 py-1 text-sm text-center"
                    />
                    <span>₴/$</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {priceRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.label}
                        onChange={e => setPriceRows(rows => rows.map(r => r.id === row.id ? { ...r, label: e.target.value } : r))}
                        className="form-input flex-1 min-w-0 text-sm py-2"
                        placeholder={t('vehicleModal.priceLabelPlaceholder')}
                      />
                      <input
                        type="number"
                        value={row.amount}
                        onChange={e => setPriceRows(rows => rows.map(r => r.id === row.id ? { ...r, amount: e.target.value } : r))}
                        min="0"
                        className="form-input w-32 text-sm py-2"
                        placeholder="0"
                      />
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => setPriceRows(rows => rows.map(r => r.id === row.id ? { ...r, currency: 'USD' } : r))}
                          className={`px-2.5 py-2 text-sm font-medium transition-colors ${row.currency === 'USD' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          $
                        </button>
                        <button
                          type="button"
                          onClick={() => setPriceRows(rows => rows.map(r => r.id === row.id ? { ...r, currency: 'UAH' } : r))}
                          className={`px-2.5 py-2 text-sm font-medium transition-colors ${row.currency === 'UAH' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          {t('vehicleModal.uah')}
                        </button>
                      </div>
                      {priceRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPriceRows(rows => rows.filter(r => r.id !== row.id))}
                          className="btn-icon text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPriceRows(rows => [...rows, newRow()])}
                  className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  {t('vehicleModal.addRow')}
                </button>

                {totalUSD > 0 && (
                  <p className="mt-2 text-sm text-gray-700">
                    {t('vehicleModal.total')} <span className="font-semibold text-green-700">${totalUSD.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                    {' = '}
                    <span className="font-semibold">{formatCurrency(totalUAH)}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Примечания */}
          <div className="mt-4 sm:mt-5">
            <label className="form-label">
              {t('vehicleModal.notes')}
            </label>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows={3}
              className="form-input"
              placeholder={t('vehicleModal.notesPlaceholder')}
            />
          </div>
        </form>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="cab-btn cab-btn-secondary flex-1"
            disabled={loading}
          >
            {t('vehicleModal.cancel')}
          </button>
          <button
            type="submit"
            form="parts-vehicle-form"
            className="cab-btn cab-btn-primary flex-1"
            disabled={loading}
          >
            {loading ? t('vehicleModal.saving') : vehicle ? t('vehicleModal.save') : t('vehicleModal.add')}
          </button>
        </div>
      </div>
    </div>
  )
}
