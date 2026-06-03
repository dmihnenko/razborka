import { useState } from 'react'
import { WorkItem } from '@/types/appointments'
import { Trash2, Wrench, Plus } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'

interface Props {
  items: WorkItem[]
  onChange: (items: WorkItem[])=> void
}

export default function WorkItemsManager({ items, onChange }: Props) {
  const [workListText, setWorkListText] = useState('')
  const [showServicesList, setShowServicesList] = useState(false)
  const { data: profile } = useUserProfile()

  const isStoWorker = profile?.roles?.some((r: any) => r.name === 'sto_worker')
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Загружаем настройки СТО
  const { data: stoCompany } = useQuery({
    queryKey: ['sto_company', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return null
      const { data, error } = await supabase
        .from('sto_companies')
        .select('services_menu_enabled')
        .eq('id', profile?.sto_company_id)
        .single()
      
      if (error) {
        console.error('Error loading STO settings:', error)
        throw error
      }
      return data
    },
    enabled: !!profile?.sto_company_id,
    staleTime: 0, // Всегда перезагружать при монтировании
  })

  // Загружаем услуги из справочника — только для текущего СТО
  const { data: services } = useQuery({
    queryKey: ['services', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return []
      const { data, error } = await supabase
        .from('services')
        .select('*, service_categories(name, color)')
        .eq('sto_company_id', profile.sto_company_id)
        .order('name')
      
      if (error) {
        // service_categories может не существовать — fallback без категорий
        const { data: plain } = await supabase
          .from('services')
          .select('*')
          .eq('sto_company_id', profile.sto_company_id)
          .order('name')
        return plain ?? []
      }
      return data
    },
    enabled: !!profile?.sto_company_id,
  })

  const totalCost = items.reduce((sum, item) => sum + item.price, 0)
  
  // Проверяем, доступно ли меню услуг
  const servicesMenuEnabled = stoCompany?.services_menu_enabled ?? true
  const canUseServicesMenu = isStoOwner || (servicesMenuEnabled && isStoWorker)

  const parseWorkItems = (text: string): WorkItem[] => {
    const lines = text.split('\n').filter(line => line.trim())
    const parsed: WorkItem[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      // Ищем последнее число в строке
      const match = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/)
      if (match) {
        const name = match[1].trim()
        const price = parseFloat(match[2])
        if (name && !isNaN(price)) {
          parsed.push({
            id: uuidv4(),
            name,
            price,
            isPaid: false,
          })
        }
      }
    }
    return parsed
  }

  const handleTextChange = (text: string) => {
    setWorkListText(text)
    const newItems = parseWorkItems(text)
    if (newItems.length > 0) {
      onChange(newItems)
    } else {
      onChange([])
    }
  }

  const handleDelete = (id: string) => {
    onChange(items.filter(item => item.id !== id))
  }

  const handleAddService = (service: any) => {
    const newItem: WorkItem = {
      id: uuidv4(),
      name: service.name,
      price: Number(service.price),
      isPaid: false,
    }
    onChange([...items, newItem])
    setShowServicesList(false)
  }

  return (
    <div className="space-y-4">
      {/* Кнопка добавления из справочника - только для владельца или если включено для работников */}
      {canUseServicesMenu && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowServicesList(!showServicesList)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить из справочника
          </button>
        </div>
      )}

      {/* Список услуг */}
      {showServicesList && (
        <div className="bg-white border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
          <h4 className="font-semibold mb-3">Выберите услугу:</h4>
          <div className="space-y-2">
            {services?.map((service: any) => (
              <button
                key={service.id}
                type="button"
                onClick={() => handleAddService(service)}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {service.name}
                      </span>
                      {service.service_categories && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: service.service_categories.color }}
                        >
                          {service.service_categories.name}
                        </span>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-sm mt-1 text-gray-500">
                        {service.description}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold ml-4 text-blue-600">
                    {service.price} ₴
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Список работ (каждая строка: название цена)
          </label>
          <textarea
            value={workListText}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Замена корыта 500&#10;Покраска бампера 1200&#10;Диагностика ходовой 300"
          />
          <p className="text-xs text-gray-500 mt-1">
            Пример: "Замена корыта 500" — название "Замена корыта", цена 500
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3 flex-1">
              <Wrench className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.name}</div>
              </div>
              <div className="font-semibold text-primary">{item.price} грн</div>
            </div>
            <div className="flex gap-2 ml-4">
              <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg font-semibold">
          <span>Итого работ:</span>
          <span className="text-lg text-primary">{totalCost.toLocaleString()} грн</span>
        </div>
      )}
    </div>
  )
}
