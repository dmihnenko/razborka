import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { X, Car } from 'lucide-react'
import { useBlockScroll } from '@/hooks/useBlockScroll'

interface VehicleData {
  id?: string
  brand: string
  model: string
  year: number
  license_plate?: string
  vin?: string
  mileage?: number | null
}

interface VehicleModalProps {
  onClose: () => void
  customerId?: string
  customerName?: string
  vehicle?: VehicleData | null
}

export default function VehicleModal({ onClose, customerId, customerName, vehicle }: VehicleModalProps) {
  const isEdit = !!vehicle?.id
  const [form, setForm] = useState({
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year ?? new Date().getFullYear(),
    license_plate: vehicle?.license_plate ?? '',
    vin: vehicle?.vin ?? '',
    mileage: vehicle?.mileage != null ? String(vehicle.mileage) : '',
  })

  useBlockScroll(true)
  const queryClient = useQueryClient()

  const set = (field: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        license_plate: form.license_plate.trim().toUpperCase(),
        vin: form.vin.trim().toUpperCase() || null,
        mileage: form.mileage ? Number(form.mileage) : null,
        customer_id: customerId,
      }
      if (isEdit) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', vehicle!.id!)
        if (error) throw error
      } else {
        const { error } = await supabase.from('vehicles').insert([payload])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-vehicles', customerId] })
      toast.success(isEdit ? 'Автомобиль обновлён' : 'Автомобиль добавлен')
      onClose()
    },
    onError: () => toast.error('Ошибка при сохранении'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[95dvh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Car className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">
                {isEdit ? 'Редактировать авто' : 'Добавить авто'}
              </h2>
              {customerName && (
                <p className="text-xs text-gray-400 leading-tight">{customerName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form id="vehicle-form" onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 space-y-3 flex-1">
          {/* Марка + Модель */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Марка <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.brand}
                onChange={e => set('brand', e.target.value)}
                placeholder="Toyota"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Модель <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.model}
                onChange={e => set('model', e.target.value)}
                placeholder="Camry"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Номер */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Гос. номер</label>
            <input
              type="text"
              value={form.license_plate}
              onChange={e => set('license_plate', e.target.value.toUpperCase())}
              placeholder="АА1234ВВ"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono tracking-widest uppercase"
            />
          </div>

          {/* Год */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Год <span className="text-red-500">*</span></label>
            <input
              type="number"
              required
              value={form.year}
              onChange={e => set('year', e.target.value)}
              min="1900"
              max={new Date().getFullYear() + 1}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* VIN */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">VIN</label>
            <input
              type="text"
              value={form.vin}
              onChange={e => set('vin', e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, '').slice(0, 17))}
              placeholder="17 символов"
              maxLength={17}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono tracking-widest"
            />
            {form.vin && (
              <p className={`text-xs mt-0.5 ${form.vin.length === 17 ? 'text-green-600' : 'text-gray-400'}`}>
                {form.vin.length}/17
              </p>
            )}
          </div>

          {/* Пробег */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Пробег (км)</label>
            <input
              type="number"
              value={form.mileage}
              onChange={e => set('mileage', e.target.value)}
              placeholder="150 000"
              min="0"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          >
            Отмена
          </button>
          <button
            type="submit"
            form="vehicle-form"
            disabled={mutation.isPending}
            className="flex-1 py-2.5 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
          >
            {mutation.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}
