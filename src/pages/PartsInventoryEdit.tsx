import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { Spinner } from '@/components/ui/Spinner'
import { PartsInventoryModal } from './PartsInventory'
import {
  getPartsInventoryItem,
  createPartsInventoryItem,
  updatePartsInventoryItem,
  appendPartsItemPhotos,
  getStorageLocations,
} from '@/services/partsService'
import { getCompanyPhotoStorage } from '@/services/photoStorageConfig'
import { supabase } from '@/lib/supabase'
import type { CreatePartsInventoryInput, PartsInventoryItem, StorageLocation } from '@/types/parts'
import type { ImgbbPhoto } from '@/services/imgbbService'

/**
 * Полноценная страница добавления/редактирования запчасти (вместо модалки).
 * Переиспользует форму PartsInventoryModal в режиме asPage; данные и save-логика —
 * такие же, как в PartsInventory. Источник (разборка/магазин) берётся из ?source=.
 */
export default function PartsInventoryEdit() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const source: 'shop' | 'vehicles' = searchParams.get('source') === 'shop' ? 'shop' : 'vehicles'
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { canCreate } = useSubscriptionLimits()

  const roles = profile?.roles?.map((r) => r.name) || []
  const canParts = roles.includes('parts_owner') || roles.includes('parts_worker') || roles.includes('admin')

  const { data: item = null, isLoading: itemLoading } = useQuery({
    queryKey: ['parts-inventory', 'item', id],
    queryFn: () => getPartsInventoryItem(id!),
    enabled: !!id,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['parts-categories', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_categories')
        .select('id, name, brand, model')
        .eq('parts_company_id', partsCompanyId)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!partsCompanyId,
  })

  const { data: vehicles = [] } = useQuery({
    queryKey: ['parts-vehicles-dropdown', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_vehicles')
        .select('id, make, model, year')
        .eq('parts_company_id', partsCompanyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!partsCompanyId,
  })

  const { data: storageLocations = [] } = useQuery({
    queryKey: ['parts-storage-locations', partsCompanyId],
    queryFn: () => getStorageLocations(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const { data: photoCfg = null } = useQuery({
    queryKey: ['parts-company-photo-storage', partsCompanyId],
    queryFn: () => getCompanyPhotoStorage(partsCompanyId!),
    enabled: !!partsCompanyId,
    staleTime: 1000 * 60 * 5,
  })

  const goBack = () => navigate(`/parts/inventory?source=${source}`)

  const saveMutation = useMutation({
    mutationFn: async ({ data, pending }: { data: CreatePartsInventoryInput; pending?: Promise<ImgbbPhoto>[]; keepOpen?: boolean }) => {
      let saved: PartsInventoryItem
      if (item) {
        saved = await updatePartsInventoryItem(item.id, data)
      } else {
        if (!canCreate.part()) throw new Error(t('inventoryPage.limitReachedError'))
        saved = await createPartsInventoryItem({ ...data, is_shop: source === 'shop' }, partsCompanyId!)
      }
      // Фото, ещё грузившиеся на момент сохранения, дописываем в ФОНЕ (пользователь не ждёт).
      if (pending && pending.length && saved?.id) {
        const savedId = saved.id
        Promise.allSettled(pending).then((results) => {
          const extra = results
            .filter((r): r is PromiseFulfilledResult<ImgbbPhoto> => r.status === 'fulfilled')
            .map((r) => r.value)
          const failed = results.filter((r) => r.status === 'rejected').length
          if (!extra.length) return
          appendPartsItemPhotos(savedId, extra)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
              if (failed) toast.error(t('inventoryPage.somePhotosFailed', { n: failed }))
            })
            .catch(() => toast.error(t('inventoryPage.photoAttachError')))
        })
      }
      return saved
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(item ? t('inventoryPage.toastUpdated') : t('inventoryPage.toastAdded'))
      // keepOpen — «Сохранить и добавить ещё»: остаёмся на странице, форму сбрасывает модалка.
      if (!variables.keepOpen) goBack()
    },
    onError: () => toast.error(t('inventoryPage.toastSaveError')),
  })

  const saveBulkMutation = useMutation({
    mutationFn: async (items: CreatePartsInventoryInput[]) => {
      for (const it of items) {
        await createPartsInventoryItem({ ...it, is_shop: source === 'shop' }, partsCompanyId!)
      }
    },
    onSuccess: (_data, items) => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(t('inventoryPage.toastBulkAdded', { n: items.length }))
      goBack()
    },
    onError: () => toast.error(t('inventoryPage.toastSaveError')),
  })

  if (profile && !canParts) return <PartsAccessDenied />
  if (!partsCompanyId || (id && itemLoading)) {
    return <div className="flex justify-center py-16"><Spinner /></div>
  }
  if (id && !item) {
    return (
      <div className="text-center py-16 text-gray-500">
        {t('inventoryPage.notFound', { defaultValue: 'Запчасть не найдена' })}
      </div>
    )
  }

  const lastVehicleId = sessionStorage.getItem('parts_last_vehicle_id') || undefined
  const lastStorageLocationId = sessionStorage.getItem('parts_last_storage_location_id') || undefined

  return (
    <div className="py-1 sm:py-2">
      <PartsInventoryModal
        asPage
        item={item}
        categories={categories}
        vehicles={vehicles}
        storageLocations={storageLocations as StorageLocation[]}
        photoCfg={photoCfg}
        onClose={goBack}
        onSave={(data, pending, keepOpen) => saveMutation.mutate({ data, pending, keepOpen })}
        onSaveBulk={(items) => saveBulkMutation.mutate(items)}
        isSaving={saveMutation.isPending || saveBulkMutation.isPending}
        initialVehicleId={item ? undefined : lastVehicleId}
        onVehicleChange={(vid) => {
          if (vid) sessionStorage.setItem('parts_last_vehicle_id', vid)
          else sessionStorage.removeItem('parts_last_vehicle_id')
        }}
        initialStorageLocationId={item ? undefined : lastStorageLocationId}
        onStorageChange={(sid) => {
          if (sid) sessionStorage.setItem('parts_last_storage_location_id', sid)
          else sessionStorage.removeItem('parts_last_storage_location_id')
        }}
      />
    </div>
  )
}
