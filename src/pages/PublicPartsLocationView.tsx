import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package, MapPin, ChevronRight, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BRAND } from '@/config/brand'
import { Spinner } from '@/components/ui/Spinner'
import { PublicBrandHeader } from '@/components/PublicBrandHeader'
import { formatPrice } from '@/utils/currency'
import type { ImgbbPhoto } from '@/services/imgbbService'

// ── Формы публичных данных (нетипизированный supabase-клиент) ───────────────────

/** Фото приходит объектом ImgbbPhoto/{display_url} либо строкой-URL. */
type PhotoLike = (Partial<ImgbbPhoto> & { display_url?: string }) | string

/** Строка запчасти для публичного списка места хранения. */
interface PublicLocationPart {
  id: string
  name: string
  part_number?: string | null
  selling_price?: number | null
  price_currency?: 'UAH' | 'USD' | null
  status: string
  photos?: PhotoLike[] | null
  storage_location_id?: string | null
  category?: { id: string; name: string } | null
}

// ── Статусы запчасти ───────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  available: 'В наличии',
  reserved:  'Резерв',
  damaged:   'Повреждено',
}
const STATUS_CLS: Record<string, string> = {
  available: 'bg-green-100 text-green-800 border-green-200',
  reserved:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  damaged:   'bg-red-100 text-red-800 border-red-200',
}

const getThumb = (p: PhotoLike) =>
  (typeof p === 'string' ? p : p?.thumb_url || p?.url || p?.display_url) || ''

/**
 * Публичная страница «Что лежит в этом месте хранения».
 * Открывается по QR-этикетке места хранения (/public/parts-location/:id).
 * Показывает запчасти, привязанные к этому месту и его под-местам.
 */
export default function PublicPartsLocationView() {
  const { id } = useParams<{ id: string }>()

  // 1. Само место хранения
  const { data: location, isLoading: loadingLoc } = useQuery({
    queryKey: ['public-location', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_storage_locations')
        .select('id, name, parent_id, parts_company_id')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 60_000,
  })

  // 2. Все места компании — для пути (хлебных крошек) и поддерева
  const { data: allLocations = [] } = useQuery({
    queryKey: ['public-location-tree', location?.parts_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_storage_locations')
        .select('id, name, parent_id')
        .eq('parts_company_id', location!.parts_company_id)
      if (error) throw error
      return data as { id: string; name: string; parent_id: string | null }[]
    },
    enabled: !!location?.parts_company_id,
    staleTime: 60_000,
  })

  // 3. Контакты разборки (шапка)
  const { data: company } = useQuery({
    queryKey: ['public-location-company', location?.parts_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_companies')
        .select('id, name')
        .eq('id', location!.parts_company_id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!location?.parts_company_id,
    staleTime: 5 * 60_000,
  })

  // Поддерево: это место + все вложенные
  const subtreeIds = useMemo(() => {
    if (!location) return []
    if (!allLocations.length) return [location.id]
    const childrenOf = new Map<string, string[]>()
    for (const l of allLocations) {
      const arr = childrenOf.get(l.parent_id ?? '') ?? []
      arr.push(l.id)
      childrenOf.set(l.parent_id ?? '', arr)
    }
    const ids: string[] = []
    const stack = [location.id]
    while (stack.length) {
      const cur = stack.pop()!
      ids.push(cur)
      for (const c of childrenOf.get(cur) ?? []) stack.push(c)
    }
    return ids
  }, [location, allLocations])

  // Путь (хлебные крошки) от корня до текущего
  const pathNames = useMemo(() => {
    if (!location) return [] as string[]
    const byId = new Map(allLocations.map(l => [l.id, l]))
    const names: string[] = []
    let cur: { id: string; name: string; parent_id: string | null } | undefined =
      byId.get(location.id) ?? { id: location.id, name: location.name, parent_id: location.parent_id }
    let guard = 0
    while (cur && guard++ < 20) {
      names.unshift(cur.name)
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return names
  }, [location, allLocations])

  // 4. Запчасти в поддереве (кроме проданных)
  const { data: parts = [], isLoading: loadingParts } = useQuery({
    queryKey: ['public-location-parts', subtreeIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_inventory')
        .select('id, name, part_number, selling_price, price_currency, status, photos, storage_location_id, category:parts_categories(id,name)')
        .in('storage_location_id', subtreeIds)
        .neq('status', 'sold')
        .order('name', { ascending: true })
      if (error) throw error
      // supabase выводит to-one join (category) как массив — форма фактически
      // объектная, поэтому граничный каст через unknown.
      return (data ?? []) as unknown as PublicLocationPart[]
    },
    enabled: subtreeIds.length > 0,
    staleTime: 30_000,
  })

  const locById = useMemo(() => new Map(allLocations.map(l => [l.id, l.name])), [allLocations])

  if (loadingLoc) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <Spinner size="xl" />
      </div>
    )
  }

  if (!location) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-gray-50">
        <MapPin className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 font-medium">Место хранения не найдено</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-8">
      <PublicBrandHeader subtitle={company?.name || 'Авторазборка'} />

      <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6">

        {/* Заголовок места */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 mb-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 flex-wrap mb-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {pathNames.length > 1
              ? pathNames.slice(0, -1).map((n, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    {n}<ChevronRight className="w-3 h-3" />
                  </span>
                ))
              : <span>Место хранения</span>}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{location.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loadingParts ? 'Загрузка…' : `${parts.length} ${parts.length === 1 ? 'запчасть' : 'запчастей'} на этом месте`}
          </p>
        </div>

        {/* Список запчастей */}
        {loadingParts ? (
          <div className="flex justify-center py-16"><Spinner size="md" /></div>
        ) : parts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">Здесь пока пусто</p>
            <p className="text-xs text-gray-400 mt-1">На этом месте хранения нет запчастей в наличии.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
            {parts.map((p) => {
              const photos: PhotoLike[] = p.photos || []
              const subLocName = p.storage_location_id && p.storage_location_id !== location.id
                ? locById.get(p.storage_location_id)
                : null
              return (
                <Link
                  key={p.id}
                  to={`/public/parts-item/${p.id}`}
                  className="flex items-center gap-3 px-3.5 py-3 hover:bg-gray-50 transition-colors"
                >
                  {photos.length > 0 ? (
                    <img
                      src={getThumb(photos[0])}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-gray-300" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{p.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${STATUS_CLS[p.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                      {p.category && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                          <Tag className="w-3 h-3" />{p.category.name}
                        </span>
                      )}
                      {subLocName && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                          <MapPin className="w-3 h-3" />{subLocName}
                        </span>
                      )}
                      {p.part_number && (
                        <span className="font-mono text-[11px] text-gray-400 uppercase truncate">{p.part_number}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {p.selling_price ? (
                      <p className="text-sm font-extrabold text-primary tabular-nums whitespace-nowrap">
                        {formatPrice(p.selling_price, (p.price_currency as 'UAH' | 'USD') || 'UAH')}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic whitespace-nowrap">по запросу</p>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 inline-block mt-1" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-6">
          Страница сгенерирована автоматически · {BRAND.name}
        </p>
      </div>
    </div>
  )
}
