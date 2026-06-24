import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { Camera, CheckCircle2, Car, Package } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsInventory, appendPartsItemPhotos } from '@/services/partsService'
import type { PartsInventoryItem } from '@/types/parts'
import { getCompanyPhotoStorage } from '@/services/photoStorageConfig'
import { uploadPhoto, PhotoProviderNotConfigured } from '@/services/photoStorage'

const MAX_PHOTOS = 5

/** Непроданная позиция без фото (пустой/отсутствующий jsonb-массив photos). */
function noPhoto(i: PartsInventoryItem): boolean {
  const p = i.photos as unknown[] | null | undefined
  return i.status !== 'sold' && (!Array.isArray(p) || p.length === 0)
}

export default function PartsNoPhotoPage() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['parts-inventory', partsCompanyId],
    queryFn: () => getPartsInventory(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const { data: photoCfg = null } = useQuery({
    queryKey: ['parts-company-photo-storage', partsCompanyId],
    queryFn: () => getCompanyPhotoStorage(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const items = inventory.filter(noPhoto)

  const handleSelect = async (item: PartsInventoryItem, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setUploadingId(item.id)
    try {
      const uploaded = []
      for (const f of files.slice(0, MAX_PHOTOS)) {
        uploaded.push(await uploadPhoto(f, photoCfg ?? null))
      }
      await appendPartsItemPhotos(item.id, uploaded)
      toast.success(t('noPhotoPage.photoAdded'))
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
    } catch (err) {
      if (err instanceof PhotoProviderNotConfigured) toast.error(err.message)
      else toast.error(t('noPhotoPage.uploadError'))
    } finally {
      setUploadingId(null)
    }
  }

  const vehicleLabel = (item: PartsInventoryItem) =>
    item.vehicle ? `${item.vehicle.make} ${item.vehicle.model}${item.vehicle.year ? ' ' + item.vehicle.year : ''}` : null

  if (!partsCompanyId) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="empty-state">
          <p className="empty-state-title">{t('noPhotoPage.noAccess')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader
        title={i18n.t('cabinet:pages.noPhoto')}
        subtitle={!isLoading ? i18n.t('cabinet:pages.noPhotoSub', { n: items.length }) : undefined}
        backPath="/parts/inventory"
        maxWidth="4xl"
      />

      <div className="w-full py-4 sm:py-6">
        {isLoading ? (
          <div className="empty-state"><Spinner size="md" className="inline-block" /></div>
        ) : items.length === 0 ? (
          <div className="cab-card p-12">
            <div className="empty-state">
              <div className="empty-state-icon">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <p className="empty-state-title">{t('noPhotoPage.allDone')}</p>
              <p className="empty-state-text">{t('noPhotoPage.allDoneText')}</p>
              <button onClick={() => navigate('/parts/inventory')} className="cab-btn cab-btn-primary mt-6">
                {t('noPhotoPage.toInventory')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map(item => {
              const busy = uploadingId === item.id
              return (
                <div key={item.id} className="cab-card p-3 flex flex-col gap-2">
                  <div className="aspect-[4/3] bg-gray-50 rounded-xl flex items-center justify-center text-gray-300">
                    <Package className="w-9 h-9" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                      {vehicleLabel(item)
                        ? <><Car className="w-3 h-3 text-gray-400 flex-shrink-0" strokeWidth={1.5} />{vehicleLabel(item)}</>
                        : <span className="text-gray-400">{t('noPhotoPage.noVehicle')}</span>}
                    </p>
                  </div>
                  <label className={`cab-btn cab-btn-primary cab-btn-sm w-full justify-center gap-1.5 ${busy ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                    <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => handleSelect(item, e)} />
                    {busy ? <Spinner size="sm" /> : <><Camera className="w-4 h-4" strokeWidth={1.5} /> {t('noPhotoPage.addPhoto')}</>}
                  </label>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
