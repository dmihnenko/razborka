import { useState } from 'react'
import { WorkItem } from '@/types/appointments'
import { Trash2, Wrench, Plus, BookOpen } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import ServiceCatalogPicker from './ServiceCatalogPicker'
import type { Service } from '@/services/servicesService'

interface Props {
  items: WorkItem[]
  onChange: (items: WorkItem[]) => void
}

export default function WorkItemsManager({ items, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const { data: profile } = useUserProfile()

  const isStoWorker = profile?.roles?.some((r: any) => r.name === 'sto_worker')
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Настройки СТО — включено ли меню услуг для работника
  const { data: stoCompany } = useQuery({
    queryKey: ['sto_company', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return null
      const { data } = await supabase
        .from('sto_companies')
        .select('services_menu_enabled')
        .eq('id', profile.sto_company_id)
        .single()
      return data
    },
    enabled: !!profile?.sto_company_id,
    staleTime: 60_000,
  })

  const servicesMenuEnabled = stoCompany?.services_menu_enabled ?? true
  const canUseCatalog = isStoOwner || (servicesMenuEnabled && isStoWorker)

  const totalCost = items.reduce((sum, item) => sum + item.price, 0)

  const addFromCatalog = (svc: Service) => {
    const newItem: WorkItem = {
      id: uuidv4(),
      name: svc.name,
      price: Number(svc.price),
      isPaid: false,
    }
    onChange([...items, newItem])
  }

  const addManual = () => {
    const name = newName.trim()
    const price = parseFloat(newPrice)
    if (!name || isNaN(price) || price < 0) return
    onChange([...items, { id: uuidv4(), name, price, isPaid: false }])
    setNewName('')
    setNewPrice('')
  }

  const handleDelete = (id: string) => onChange(items.filter(i => i.id !== id))

  return (
    <div className="space-y-4">
      {/* Catalog picker toggle */}
      {canUseCatalog && (
        <div>
          <button
            type="button"
            onClick={() => setShowPicker(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" />
            {showPicker ? 'Скрыть каталог' : 'Выбрать из каталога'}
          </button>

          {showPicker && profile?.sto_company_id && (
            <div className="mt-2">
              <ServiceCatalogPicker
                stoCompanyId={profile.sto_company_id}
                selectedNames={items.map(i => i.name)}
                onSelect={addFromCatalog}
                onClose={() => setShowPicker(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Manual add row */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Название работы"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addManual() }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <input
          type="number"
          placeholder="Цена ₴"
          min="0"
          step="0.01"
          value={newPrice}
          onChange={e => setNewPrice(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addManual() }}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          type="button"
          onClick={addManual}
          disabled={!newName.trim() || !newPrice}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded-lg transition-colors"
          title="Добавить"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Items list */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-200 rounded-lg">
              <Wrench className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-900">{item.name}</span>
              <span className="text-sm font-semibold text-primary flex-shrink-0">{item.price.toLocaleString()} ₴</span>
              <button type="button" onClick={() => handleDelete(item.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Итого работы:</span>
            <span className="text-base font-bold text-primary">{totalCost.toLocaleString()} ₴</span>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-4">Работы не добавлены</p>
      )}
    </div>
  )
}
