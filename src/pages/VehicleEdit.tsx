import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Car, User } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import ClientSelector from '@/components/appointments/ClientSelector'
import { useUserProfile } from '@/hooks/useUserProfile'
import {
  fetchVehicleById, createVehicle, updateVehicle,
  FUEL_TYPES, type VehicleSaveData,
} from '@/services/vehiclesService'

const num = (v: string) => (v === '' ? null : Number(v))

export default function VehicleEdit() {
  const { vehicleId } = useParams()
  const isEdit = !!vehicleId
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const { data: profile } = useUserProfile()

  const [customerId, setCustomerId] = useState(searchParams.get('customer') || '')
  const [customer, setCustomer] = useState<any>(null)
  const [form, setForm] = useState({
    brand: '', model: '', year: '', license_plate: '', vin: '',
    color: '', mileage: '', engine_volume: '', fuel_type: '',
  })

  const { data: existing, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => fetchVehicleById(vehicleId!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!existing) return
    setCustomerId(existing.customer_id)
    setForm({
      brand: existing.brand || '',
      model: existing.model || '',
      year: existing.year ? String(existing.year) : '',
      license_plate: existing.license_plate || '',
      vin: existing.vin || '',
      color: existing.color || '',
      mileage: existing.mileage != null ? String(existing.mileage) : '',
      engine_volume: existing.engine_volume != null ? String(existing.engine_volume) : '',
      fuel_type: existing.fuel_type || '',
    })
  }, [existing])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: VehicleSaveData = {
        customer_id: customerId,
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: Number(form.year) || new Date().getFullYear(),
        license_plate: form.license_plate.trim(),
        vin: form.vin.trim(),
        color: form.color.trim(),
        mileage: num(form.mileage),
        engine_volume: num(form.engine_volume),
        fuel_type: form.fuel_type || null,
      }
      if (isEdit) return updateVehicle(vehicleId!, payload)
      return createVehicle(payload, profile?.sto_company_id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['customer-vehicles'] })
      toast.success(isEdit ? 'Автомобиль обновлён' : 'Автомобиль добавлен')
      navigate(-1)
    },
    onError: (e: any) => {
      const msg = String(e?.message || '')
      if (msg.startsWith('409')) toast.error('Гос. номер или VIN уже используются')
      else toast.error(msg || 'Ошибка сохранения')
    },
  })

  const canSave = !!customerId && form.brand.trim() && form.model.trim() && !!profile?.sto_company_id

  if (isEdit && isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Spinner size="lg" /></div>
  )

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-3 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 text-base flex-1">{isEdit ? 'Редактирование авто' : 'Новый автомобиль'}</h1>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            className="btn-primary btn-sm"
          >
            {saveMutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="w-full px-3 sm:px-6 py-5 max-w-3xl mx-auto space-y-4">
        {/* Клиент */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Владелец</h2>
            {(customer?.name || existing?.customers?.name) && (
              <span className="text-sm text-gray-500">· {customer?.name || existing?.customers?.name}</span>
            )}
          </div>
          {isEdit ? (
            <p className="text-sm text-gray-600">{existing?.customers?.name || '—'}</p>
          ) : (
            <ClientSelector
              selectedId={customerId}
              onSelect={(id, c) => { setCustomerId(id); setCustomer(c) }}
            />
          )}
        </div>

        {/* Авто */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Car className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Автомобиль</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Марка *</label>
              <input value={form.brand} onChange={set('brand')} className="form-input" placeholder="напр. Toyota" />
            </div>
            <div>
              <label className="form-label">Модель *</label>
              <input value={form.model} onChange={set('model')} className="form-input" placeholder="напр. Camry" />
            </div>
            <div>
              <label className="form-label">Год</label>
              <input type="number" value={form.year} onChange={set('year')} className="form-input" placeholder="2020" />
            </div>
            <div>
              <label className="form-label">Гос. номер</label>
              <input value={form.license_plate} onChange={set('license_plate')} className="form-input" placeholder="AA1234BB" />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">VIN</label>
              <input value={form.vin} onChange={set('vin')} className="form-input font-mono" placeholder="необязательно" />
            </div>
            <div>
              <label className="form-label">Объём двигателя, л</label>
              <input type="number" step="0.1" min="0" inputMode="decimal" value={form.engine_volume} onChange={set('engine_volume')} className="form-input" placeholder="напр. 1.6" />
            </div>
            <div>
              <label className="form-label">Тип топлива</label>
              <select value={form.fuel_type} onChange={set('fuel_type')} className="form-select">
                <option value="">—</option>
                {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Пробег, км</label>
              <input type="number" min="0" value={form.mileage} onChange={set('mileage')} className="form-input" placeholder="напр. 120000" />
            </div>
            <div>
              <label className="form-label">Цвет</label>
              <input value={form.color} onChange={set('color')} className="form-input" placeholder="напр. чёрный" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
