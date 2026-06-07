import { useParams } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Package, Tag, Hash, FileText, Car, Phone, Mail,
  MapPin, CheckCircle, Clock, AlertTriangle, DollarSign,
} from 'lucide-react'
import { PublicBrandHeader } from '@/components/PublicBrandHeader'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'
import PhotoGallery from '@/components/parts/PhotoGallery'

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  available: 'В наличии',
  reserved:  'Зарезервировано',
  sold:      'Продано',
  damaged:   'Повреждено',
}
const STATUS_STYLE: Record<string, string> = {
  available: 'bg-green-100 text-green-800 border-green-200',
  reserved:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  sold:      'bg-gray-100 text-gray-500 border-gray-200',
  damaged:   'bg-red-100 text-red-800 border-red-200',
}
const STATUS_ICON: Record<string, React.ReactNode> = {
  available: <CheckCircle className="w-4 h-4" />,
  reserved:  <Clock className="w-4 h-4" />,
  sold:      <DollarSign className="w-4 h-4" />,
  damaged:   <AlertTriangle className="w-4 h-4" />,
}

function fmtPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

// ─── component ────────────────────────────────────────────────────────────────

export default function PublicPartsItemView() {
  const { id } = useParams<{ id: string }>()

  // Загружаем запчасть (публичный доступ — без фильтра по company)
  const { data: item, isLoading } = useQuery({
    queryKey: ['public-parts-item', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_inventory')
        .select(`
          *,
          category:parts_categories(id, name),
          vehicle:parts_vehicles!vehicle_id(id, make, model, year, vin)
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 60_000,
  })

  // Загружаем компанию по parts_company_id из запчасти
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

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <Spinner size="xl" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <Package className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 font-medium">Запчасть не найдена</p>
      </div>
    )
  }

  const photos    = (item.photos as any[]) || []
  const isSold    = item.status === 'sold'
  const currency  = (item.price_currency as 'UAH' | 'USD') || 'UAH'
  const phoneRaw  = company?.phone ? fmtPhone(company.phone) : null

  return (
    <div className="min-h-dvh bg-gray-50 pb-10">

      {/* Brand header */}
      <PublicBrandHeader subtitle={company?.name || 'Авторазборка'} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── Фото ─────────────────────────────────────────────────────── */}
        {photos.length > 0 && (
          <PhotoGallery
            photos={photos}
            alt={item.name}
            mainAspect="aspect-video sm:aspect-[16/7]"
          />
        )}

        {/* ── Основная информация ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">

          {/* Статус + категория */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium border ${STATUS_STYLE[item.status] ?? ''}`}>
              {STATUS_ICON[item.status]}
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
            {item.category && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100">
                <Tag className="w-3.5 h-3.5" />
                {item.category.name}
              </span>
            )}
          </div>

          {/* Название */}
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 leading-tight">
            {item.name}
          </h1>

          {/* Артикул */}
          {item.part_number && (
            <p className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
              <Hash className="w-4 h-4" />
              Артикул: <span className="font-mono font-medium text-gray-700">{item.part_number}</span>
            </p>
          )}

          {/* Цена */}
          <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/15">
            {isSold ? (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Продано за</p>
                <p className="text-2xl font-bold text-gray-600">
                  {item.sold_price ? formatPrice(item.sold_price, currency) : '—'}
                </p>
              </div>
            ) : item.selling_price ? (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Цена</p>
                <p className="text-3xl font-bold text-primary">
                  {formatPrice(item.selling_price, currency)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Цена уточняйте у продавца</p>
            )}
          </div>
        </div>

        {/* ── Характеристики ────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Характеристики</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">Состояние</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {PARTS_CONDITION_LABELS[item.condition] || item.condition || '—'}
              </dd>
            </div>
            {item.quantity > 1 && (
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">Количество</dt>
                <dd className="text-sm font-semibold text-gray-900">{item.quantity} шт.</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">Добавлена</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {new Date(item.created_at).toLocaleDateString('ru-RU', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </dd>
            </div>
          </dl>
        </div>

        {/* ── Автомобиль ────────────────────────────────────────────────── */}
        {item.vehicle && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Car className="w-4 h-4" />
              Снята с автомобиля
            </h2>
            <p className="text-base font-semibold text-gray-900">
              {item.vehicle.make} {item.vehicle.model}
              {item.vehicle.year && <span className="font-normal text-gray-500 ml-1">({item.vehicle.year})</span>}
            </p>
            {item.vehicle.vin && (
              <p className="text-xs text-gray-500 font-mono mt-0.5">VIN: {item.vehicle.vin}</p>
            )}
          </div>
        )}

        {/* ── Описание ──────────────────────────────────────────────────── */}
        {item.description && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Описание
            </h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.description}</p>
          </div>
        )}

        {/* ── Заметки ───────────────────────────────────────────────────── */}
        {item.notes && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Примечания</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
          </div>
        )}

        {/* ── Контакты разборки ─────────────────────────────────────────── */}
        {company && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            {/* Заголовок */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-800">{company.name}</h2>
              {company.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{company.description}</p>
              )}
            </div>

            <div className="p-4 space-y-3">
              {/* Телефон */}
              {company.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Телефон</p>
                    <a
                      href={`tel:${phoneRaw}`}
                      className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors"
                    >
                      {company.phone}
                    </a>
                  </div>
                </div>
              )}

              {/* Email */}
              {company.email && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Email</p>
                    <a
                      href={`mailto:${company.email}`}
                      className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors"
                    >
                      {company.email}
                    </a>
                  </div>
                </div>
              )}

              {/* Адрес */}
              {company.address && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Адрес</p>
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{company.address}</p>
                  </div>
                </div>
              )}

              {/* Кнопки быстрой связи */}
              {phoneRaw && (
                <div className="flex gap-2 pt-1">
                  <a
                    href={`tel:${phoneRaw}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Позвонить
                  </a>
                  <a
                    href={`https://wa.me/${phoneRaw.replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {/* WhatsApp icon via SVG */}
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.114 1.524 5.84L.057 23.547a.563.563 0 00.692.692l5.7-1.468A11.963 11.963 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.034-1.384l-.36-.214-3.735.961.982-3.624-.234-.371A9.818 9.818 0 0112 2.182c5.427 0 9.818 4.391 9.818 9.818S17.427 21.818 12 21.818z"/></svg>
                    WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pt-2">
          Страница сгенерирована автоматически · TSP CRM
        </p>
      </div>
    </div>
  )
}
