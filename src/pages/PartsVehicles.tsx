import { useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { intlLocale } from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'
import { QueryState } from '@/components/ui/QueryState'
import { Plus, Search, Car, Filter, Grid, List, Download, Upload, FileSpreadsheet, X, ChevronDown, CheckSquare, Square } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import LimitReachedBanner from '@/components/subscription/LimitReachedBanner'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getPartsVehicles, createPartsVehicle, updatePartsVehicle, deletePartsVehicle, getPartsCategoryTemplates, getPartsInventoryByVehicle, getVehicleRoi, getPartsInventory, createPartsInventoryItem, updatePartsInventoryItem, updateVehicleStatus } from '@/services/partsService'
import { moveToTrash } from '@/services/trashService'
import { exportVehiclesXlsx, downloadVehiclesTemplate, parseVehiclesFile, type ParsedVehicle } from '@/utils/vehiclesXlsx'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import PartsVehicleModal from '@/components/parts/PartsVehicleModal'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { PartsVehicle, CreatePartsVehicleInput, PartsVehicleStatus, PartsInventoryStatus, VehicleRoi, PartsInventoryItem } from '@/types/parts'

/** Бейдж окупаемости авто: % возврата + цвет (окупилось/в процессе/в минусе). */
function roiBadge(r?: VehicleRoi): { pct: number; cls: string } | null {
  if (!r || r.investment_usd == null || r.investment_usd <= 0) return null
  const paid = r.realized_usd >= r.investment_usd
  const loss = r.realized_usd + r.stock_usd < r.investment_usd
  const cls = paid
    ? 'text-emerald-700 bg-emerald-50 ring-emerald-100'
    : loss
      ? 'text-red-700 bg-red-50 ring-red-100'
      : 'text-amber-700 bg-amber-50 ring-amber-100'
  return { pct: r.payback_pct ?? 0, cls }
}

// ── Импорт: план сверки (новые/без изменений/изменённые) ──
type ImportDecision = 'create' | 'skip' | 'update'
interface VDiff { label: string; from: string; to: string }
// Изменённая запчасть существующего авто (цена/кол-во/статус/…): было→стало
interface PartChange {
  existingId: string
  name: string
  diffs: VDiff[]
  patch: Partial<PartsInventoryItem>
  decision: 'update' | 'skip'
}
interface PlanItem {
  pv: ParsedVehicle
  matchId?: string
  kind: 'new' | 'same' | 'changed'
  diffs: VDiff[]
  partChanges: PartChange[]
  partAdds: number
  decision: ImportDecision
}
const V_STATUS_S: Record<string, string> = { awaiting: 'Ожидает', in_progress: 'В разборе', dismantled: 'Разобран' }
const INV_STATUS_S: Record<string, string> = { available: 'В наличии', reserved: 'Резерв', sold: 'Продано', damaged: 'Брак' }
const COND_S: Record<string, string> = { new: 'Новая', used: 'Б/У', damaged: 'Повреждённая' }
const vNorm = (x: string | number | null | undefined): string => (x == null || x === '') ? '' : String(x).trim()
const partKey = (pn?: string | null, name?: string | null) => ((pn || name || '').toLowerCase().trim())
function vehKey(v: { vin?: string | null; make: string; model: string; year?: number | null }): string {
  const vin = (v.vin || '').toUpperCase().trim()
  return vin || `${v.make}|${v.model}|${v.year ?? ''}`.toLowerCase().trim()
}
function buildPlan(parsedVehicles: ParsedVehicle[], existing: PartsVehicle[], existingParts: PartsInventoryItem[]): PlanItem[] {
  const byKey = new Map(existing.map((v) => [vehKey(v), v]))
  const partsByVeh = new Map<string, PartsInventoryItem[]>()
  existingParts.forEach((p) => {
    if (!p.vehicle_id) return
    const a = partsByVeh.get(p.vehicle_id) || []; a.push(p); partsByVeh.set(p.vehicle_id, a)
  })
  return parsedVehicles.filter((pv) => !pv._error).map((pv): PlanItem => {
    const ex = byKey.get(vehKey(pv))
    if (!ex) return { pv, kind: 'new', diffs: [], partChanges: [], partAdds: pv.parts.length, decision: 'create' }
    const diffs: VDiff[] = []
    const cmp = (label: string, a: string | number | null | undefined, b: string | number | null | undefined) => {
      const an = vNorm(a), bn = vNorm(b)
      if (an !== bn) diffs.push({ label, from: bn || '—', to: an || '—' })
    }
    cmp('Год', pv.year, ex.year)
    cmp('Госномер', pv.license_plate, ex.license_plate)
    cmp('Цвет', pv.color, ex.color)
    cmp('Пробег', pv.mileage, ex.mileage)
    cmp('Цена покупки', pv.purchase_price, ex.purchase_price)
    cmp('Курс', pv.exchange_rate, ex.exchange_rate)
    cmp('Статус', V_STATUS_S[pv.status], V_STATUS_S[ex.status])

    // Сверка запчастей по ключу (OEM/название)
    const exParts = new Map((partsByVeh.get(ex.id) || []).map((p) => [partKey(p.part_number, p.name), p]))
    const partChanges: PartChange[] = []
    let partAdds = 0
    for (const pp of pv.parts) {
      const exp = exParts.get(partKey(pp.part_number, pp.name))
      if (!exp) { partAdds++; continue }
      const pd: VDiff[] = []
      const patch: Partial<PartsInventoryItem> = {}
      if (pp.selling_price != null && vNorm(pp.selling_price) !== vNorm(exp.selling_price)) {
        pd.push({ label: 'Цена', from: vNorm(exp.selling_price) || '—', to: vNorm(pp.selling_price) }); patch.selling_price = pp.selling_price
      }
      if (vNorm(pp.quantity) !== vNorm(exp.quantity)) {
        pd.push({ label: 'Кол-во', from: vNorm(exp.quantity) || '—', to: vNorm(pp.quantity) }); patch.quantity = pp.quantity
      }
      if (pp.status !== exp.status) {
        pd.push({ label: 'Статус', from: INV_STATUS_S[exp.status] || exp.status, to: INV_STATUS_S[pp.status] || pp.status }); patch.status = pp.status as PartsInventoryStatus
      }
      if (pp.condition !== exp.condition) {
        pd.push({ label: 'Состояние', from: COND_S[exp.condition] || exp.condition, to: COND_S[pp.condition] || pp.condition }); patch.condition = pp.condition
      }
      const exLoc = exp.storage_location?.name || exp.location || ''
      if (pp.location && vNorm(pp.location) !== vNorm(exLoc)) {
        pd.push({ label: 'Место', from: exLoc || '—', to: pp.location }); patch.location = pp.location
      }
      if (pd.length > 0) partChanges.push({ existingId: exp.id, name: pp.name, diffs: pd, patch, decision: 'update' })
    }

    if (diffs.length === 0 && partChanges.length === 0 && partAdds === 0)
      return { pv, matchId: ex.id, kind: 'same', diffs, partChanges, partAdds, decision: 'skip' }
    return { pv, matchId: ex.id, kind: 'changed', diffs, partChanges, partAdds, decision: 'update' }
  })
}

const statusBadge: Record<PartsVehicleStatus, string> = {
  awaiting:    'cab-chip text-amber-700 bg-amber-50 border-amber-200',
  in_progress: 'cab-chip cab-chip-signal',
  dismantled:  'cab-chip text-emerald-700 bg-emerald-50 border-emerald-200',
}

const statusDot: Record<PartsVehicleStatus, string> = {
  awaiting:    'bg-yellow-500',
  in_progress: 'bg-blue-500',
  dismantled:  'bg-green-500',
}

type ViewMode = 'grid' | 'list'

export default function PartsVehicles() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const { rate: globalRate } = usePartsExchangeRate()

  const statusLabels: Record<PartsVehicleStatus, string> = {
    awaiting: t('vehiclesPage.statusAwaiting'),
    in_progress: t('vehiclesPage.statusInProgress'),
    dismantled: t('vehiclesPage.statusDismantled'),
  }

  const formatPriceUSD = (vehicle: PartsVehicle) => {
    if (!vehicle.purchase_price) return '—'
    const rate = vehicle.exchange_rate || globalRate
    if (!rate) return '—' // курс ещё не загружен — показываем «—» вместо NaN
    const usd = vehicle.purchase_price / rate
    return '$' + usd.toLocaleString(intlLocale(), { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<PartsVehicle | null>(null)
  // Импорт/экспорт
  const [importOpen, setImportOpen] = useState(false)
  const [parsed, setParsed] = useState<{ vehicles: ParsedVehicle[] } | null>(null)
  const [plan, setPlan] = useState<PlanItem[] | null>(null)
  const [existingParts, setExistingParts] = useState<PartsInventoryItem[]>([])
  const [exporting, setExporting] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { canCreate, usage, limits } = useSubscriptionLimits()

  // Fetch vehicles
  const { data: vehicles = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['parts-vehicles', partsCompanyId],
    queryFn: () => getPartsVehicles(partsCompanyId!),
    enabled: !!partsCompanyId
  })

  // Окупаемость по каждому авто (тот же RPC, что и страница «Окупаемость авто»)
  const { data: roiList = [] } = useQuery({
    queryKey: ['vehicle-roi', partsCompanyId, globalRate],
    queryFn: () => getVehicleRoi(partsCompanyId!, globalRate!),
    enabled: !!partsCompanyId && globalRate != null,
    staleTime: 5 * 60 * 1000,
  })
  const roiByVehicle = useMemo(
    () => new Map(roiList.map((r) => [r.vehicle_id, r])),
    [roiList],
  )

  // Create/Update vehicle
  const saveMutation = useMutation({
    mutationFn: async (data: CreatePartsVehicleInput) => {
      if (selectedVehicle) {
        return updatePartsVehicle(selectedVehicle.id, data)
      } else {
        if (!canCreate.vehicle()) throw new Error(t('vehiclesPage.limitReachedError'))
        return createPartsVehicle(data, partsCompanyId!)
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      toast.success(selectedVehicle ? t('vehiclesPage.vehicleUpdated') : t('vehiclesPage.vehicleAdded'))
      setIsModalOpen(false)
      // Check for brand templates when creating new vehicle
      if (!selectedVehicle && data?.make) {
        const make = data.make
        getPartsCategoryTemplates(make).then(templates => {
          if (templates.length > 0) {
            toast(t('vehiclesPage.templatesFound', { n: templates.length, make }), {
              description: t('vehiclesPage.templatesDescription'),
              action: {
                label: t('vehiclesPage.open'),
                onClick: () => navigate(`/parts/categories?tab=templates&brand=${encodeURIComponent(make)}`),
              },
              duration: 9000,
            })
          }
        }).catch(() => {})
      }
      setSelectedVehicle(null)
    },
    onError: (error) => {
      const err = error as { message?: string; details?: string } | null
      const msg = err?.message || err?.details || t('vehiclesPage.saveError')
      toast.error(msg)
      console.error(error)
    }
  })

  // Delete vehicle
  const deleteMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const vehicle = await import('@/services/partsService').then(m => m.getPartsVehicle(vehicleId).catch(() => null))
      const parts = await getPartsInventoryByVehicle(vehicleId)
      if (vehicle) {
        await moveToTrash({
          entityType: 'parts_vehicle',
          entityId: vehicleId,
          entityLabel: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || t('vehiclesPage.entityFallback'),
          entityData: { vehicle, parts: parts || [] },
          partsCompanyId,
        })
      }
      await deletePartsVehicle(vehicleId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      toast.success(t('vehiclesPage.vehicleDeleted'))
    },
    onError: () => {
      toast.error(t('vehiclesPage.deleteError'))
    }
  })

  // ── Экспорт: авто + их запчасти в оформленный XLSX (по выбору) ──
  const handleExport = async (list: PartsVehicle[]) => {
    setExportMenu(false)
    if (list.length === 0) { toast.error(t('vehiclesPage.exportEmpty')); return }
    setExporting(true)
    try {
      const all = await getPartsInventory(partsCompanyId!)
      const res = await exportVehiclesXlsx({ vehicles: list, parts: all, roi: roiByVehicle, summary: list.length > 1 })
      toast.success(t('vehiclesPage.exportDone', { v: res.vehicles, p: res.parts }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('vehiclesPage.exportError'))
    } finally {
      setExporting(false)
    }
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    try {
      const data = await parseVehiclesFile(file)
      // Существующие запчасти (для досоздания недостающих к обновляемым авто)
      const allParts = await getPartsInventory(partsCompanyId!).catch(() => [] as PartsInventoryItem[])
      setExistingParts(allParts)
      setParsed(data)
      setPlan(buildPlan(data.vehicles, vehicles, allParts))
    } catch {
      toast.error(t('vehiclesPage.importParseError'))
    } finally {
      setParsing(false)
    }
  }

  const setDecision = (idx: number, decision: ImportDecision) =>
    setPlan((prev) => prev ? prev.map((it, i) => (i === idx ? { ...it, decision } : it)) : prev)
  const setAllChanged = (decision: ImportDecision) =>
    setPlan((prev) => prev ? prev.map((it) => (it.kind === 'changed' ? { ...it, decision } : it)) : prev)
  // Решение по конкретной изменённой запчасти внутри авто
  const setPartDecision = (idx: number, pcIdx: number, decision: 'update' | 'skip') =>
    setPlan((prev) => prev ? prev.map((it, i) => i === idx
      ? { ...it, partChanges: it.partChanges.map((pc, j) => j === pcIdx ? { ...pc, decision } : pc) }
      : it) : prev)

  // ── Импорт по плану: создать новые / обновить изменённые / пропустить ──
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!plan) return { created: 0, updated: 0, skipped: 0, parts: 0, partsUpdated: 0 }
      // Существующие запчасти по авто — для досоздания недостающих
      const partsByVeh = new Map<string, PartsInventoryItem[]>()
      existingParts.forEach((p) => {
        if (!p.vehicle_id) return
        const a = partsByVeh.get(p.vehicle_id) || []; a.push(p); partsByVeh.set(p.vehicle_id, a)
      })
      let created = 0, updated = 0, skipped = 0, parts = 0, partsUpdated = 0

      const addParts = async (vehicleId: string, list: ParsedVehicle['parts'], existing: PartsInventoryItem[]) => {
        const seen = new Set(existing.map((p) => partKey(p.part_number, p.name)))
        for (const pp of list) {
          if (seen.has(partKey(pp.part_number, pp.name))) continue   // запчасть уже есть → пропуск (обновление — отдельно)
          await createPartsInventoryItem({
            name: pp.name, part_number: pp.part_number, condition: pp.condition,
            quantity: pp.quantity, selling_price: pp.selling_price, price_currency: pp.price_currency,
            location: pp.location, vehicle_id: vehicleId, status: 'available',
          }, partsCompanyId!)
          seen.add(partKey(pp.part_number, pp.name)); parts++
        }
      }

      for (const it of plan) {
        const pv = it.pv
        if (it.decision === 'skip') { skipped++; continue }
        if (it.decision === 'create') {
          if (!canCreate.vehicle()) { skipped++; continue }
          const v = await createPartsVehicle({
            make: pv.make, model: pv.model, year: pv.year, vin: pv.vin,
            license_plate: pv.license_plate, color: pv.color, mileage: pv.mileage,
            purchase_price: pv.purchase_price, purchase_date: pv.purchase_date, exchange_rate: pv.exchange_rate,
          }, partsCompanyId!)
          created++
          if (pv.status !== 'awaiting') { try { await updateVehicleStatus(v.id, pv.status, v) } catch { /* ignore */ } }
          await addParts(v.id, pv.parts, [])
        } else if (it.decision === 'update' && it.matchId) {
          if (it.diffs.length > 0) {
            await updatePartsVehicle(it.matchId, {
              year: pv.year, vin: pv.vin, license_plate: pv.license_plate, color: pv.color,
              mileage: pv.mileage, purchase_price: pv.purchase_price, purchase_date: pv.purchase_date,
              exchange_rate: pv.exchange_rate,
            })
            try { await updateVehicleStatus(it.matchId, pv.status) } catch { /* ignore */ }
          }
          // Изменённые запчасти — было→стало (по решению пользователя)
          for (const pc of it.partChanges) {
            if (pc.decision !== 'update') continue
            await updatePartsInventoryItem(pc.existingId, pc.patch)
            partsUpdated++
          }
          updated++
          await addParts(it.matchId, pv.parts, partsByVeh.get(it.matchId) || [])
        }
      }
      return { created, updated, skipped, parts, partsUpdated }
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-roi'] })
      toast.success(t('vehiclesPage.importDone2', { created: r.created, updated: r.updated, parts: r.parts, skipped: r.skipped }) + (r.partsUpdated ? t('vehiclesPage.importPartsUpdated', { n: r.partsUpdated }) : ''))
      setImportOpen(false); setParsed(null); setPlan(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('vehiclesPage.importError')),
  })

  // Filter vehicles
  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = searchQuery === '' ||
      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.license_plate?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Group by status for statistics
  const stats = {
    total: vehicles.length,
    awaiting: vehicles.filter(v => v.status === 'awaiting').length,
    in_progress: vehicles.filter(v => v.status === 'in_progress').length,
    dismantled: vehicles.filter(v => v.status === 'dismantled').length,
  }

  const handleEdit = (vehicle: PartsVehicle, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedVehicle(vehicle)
    setIsModalOpen(true)
  }

  const handleDelete = async (vehicleId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await showConfirm({ message: t('vehiclesPage.deleteConfirm'), danger: true })
    if (!ok) return
    deleteMutation.mutate(vehicleId)
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title={i18n.t('cabinet:pages.vehicles')}
        subtitle={i18n.t('cabinet:pages.totalN', { n: stats.total })}
        backPath="/parts/dashboard"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="cab-btn cab-btn-secondary cab-btn-sm"
              title={t('vehiclesPage.import')}
            >
              <Upload className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden lg:inline">{t('vehiclesPage.import')}</span>
            </button>
            {/* Экспорт по выбору: все / фильтр / выбранные */}
            <div className="relative">
              <button
                onClick={() => setExportMenu((v) => !v)}
                disabled={exporting || vehicles.length === 0}
                className="cab-btn cab-btn-secondary cab-btn-sm"
                title={t('vehiclesPage.export')}
              >
                <Download className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden lg:inline">{exporting ? t('vehiclesPage.exporting') : t('vehiclesPage.export')}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" strokeWidth={1.5} />
              </button>
              {exportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportMenu(false)} />
                  <div className="absolute right-0 mt-1 w-60 cab-card p-1.5 z-50 shadow-lg">
                    <button onClick={() => handleExport(vehicles)} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                      <span>{t('vehiclesPage.exportAll')}</span>
                      <span className="kicker tabular-nums">{vehicles.length}</span>
                    </button>
                    {filteredVehicles.length !== vehicles.length && (
                      <button onClick={() => handleExport(filteredVehicles)} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                        <span>{t('vehiclesPage.exportFiltered')}</span>
                        <span className="kicker tabular-nums">{filteredVehicles.length}</span>
                      </button>
                    )}
                    <button
                      disabled={selectedIds.size === 0}
                      onClick={() => handleExport(vehicles.filter((v) => selectedIds.has(v.id)))}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <span>{t('vehiclesPage.exportSelected')}</span>
                      <span className="kicker tabular-nums">{selectedIds.size}</span>
                    </button>
                    <div className="h-px bg-gray-100 my-1" />
                    <button
                      onClick={() => { setSelectMode((v) => !v); setExportMenu(false); if (selectMode) setSelectedIds(new Set()) }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      {selectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      {selectMode ? t('vehiclesPage.selectModeOff') : t('vehiclesPage.selectModeOn')}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedVehicle(null)
                setIsModalOpen(true)
              }}
              className="cab-btn cab-btn-primary cab-btn-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('vehiclesPage.add')}</span>
            </button>
          </div>
        }
      />

      <div className="page-container animate-fade-in">

      {/* Limit reached banner */}
      {!canCreate.vehicle() && limits.maxVehicles !== null && (
        <div className="mb-5">
          <LimitReachedBanner
            used={usage.vehicles}
            max={limits.maxVehicles}
            label={t('vehiclesPage.vehiclesLabel')}
            ctaHref="/parts/subscription"
          />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {([
          { key: 'all',         label: t('vehiclesPage.statTotal'),    value: stats.total,       dotCls: 'bg-gray-400',   ringCls: 'ring-primary' },
          { key: 'awaiting',    label: t('vehiclesPage.statAwaiting'),  value: stats.awaiting,    dotCls: statusDot.awaiting,    ringCls: 'ring-yellow-500' },
          { key: 'in_progress', label: t('vehiclesPage.statInProgress'), value: stats.in_progress, dotCls: statusDot.in_progress, ringCls: 'ring-blue-500' },
          { key: 'dismantled',  label: t('vehiclesPage.statDismantled'),value: stats.dismantled,  dotCls: statusDot.dismantled,  ringCls: 'ring-green-500' },
        ] as const).map(({ key, label, value, dotCls, ringCls }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`cab-card p-4 text-left ${statusFilter === key ? `ring-2 ${ringCls}` : ''}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="kicker">{label}</span>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums" style={{ letterSpacing: '-0.03em' }}>
              {value}
            </p>
          </button>
        ))}
      </div>

      {/* Filters & View Controls */}
      <div className="cab-card mb-5 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t('vehiclesPage.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-9"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 self-start sm:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`btn-icon-sm ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title={t('vehiclesPage.gridView')}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`btn-icon-sm ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title={t('vehiclesPage.listView')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {statusFilter !== 'all' && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm text-gray-500">
              {t('vehiclesPage.filterLabel')} <span className="font-semibold text-gray-700">{statusLabels[statusFilter as PartsVehicleStatus]}</span>
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className="text-sm text-primary hover:underline font-medium"
            >
              {t('vehiclesPage.reset')}
            </button>
          </div>
        )}
      </div>

      {/* Vehicles List/Grid */}
      {isError ? (
        <QueryState isError onRetry={() => { void refetch() }}>{null}</QueryState>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="cab-card p-4">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Car className="w-8 h-8 text-gray-400" />
            </div>
            <p className="empty-state-title">
              {searchQuery || statusFilter !== 'all' ? t('vehiclesPage.notFound') : t('vehiclesPage.empty')}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <>
                <p className="empty-state-text">{t('vehiclesPage.emptyText')}</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="cab-btn cab-btn-primary mt-5"
                >
                  <Plus className="w-4 h-4" />
                  {t('vehiclesPage.addVehicle')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid (mobile: 1 col, sm: 2, lg: 3) ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              onClick={() => selectMode ? toggleSelect(vehicle.id) : navigate(`/parts/vehicles/${vehicle.id}`)}
              className={`cab-card cab-card-hover flex flex-col overflow-hidden relative ${selectMode && selectedIds.has(vehicle.id) ? 'ring-2 ring-primary' : ''}`}
            >
              {selectMode && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(vehicle.id) }}
                  className="absolute top-2 right-2 z-10 p-1 rounded-md bg-white/85 backdrop-blur-sm shadow-sm"
                  aria-label={t('vehiclesPage.select')}
                >
                  {selectedIds.has(vehicle.id)
                    ? <CheckSquare className="w-4 h-4 text-primary" />
                    : <Square className="w-4 h-4 text-gray-400" />}
                </button>
              )}
              {/* Card body */}
              <div className="p-4 flex-1">
                {/* Status */}
                <div className="mb-3">
                  <span className={statusBadge[vehicle.status]}>
                    {statusLabels[vehicle.status]}
                  </span>
                </div>

                {/* Title */}
                <h3 className="heading-3 mb-0.5 group-hover:text-primary transition-colors">
                  {vehicle.make} {vehicle.model}
                </h3>
                {vehicle.year && (
                  <p className="text-sm text-gray-500 tabular-nums">{vehicle.year} {t('vehiclesPage.yearSuffix')}</p>
                )}

                {/* Details */}
                <div className="mt-3 space-y-1.5 text-sm">
                  {vehicle.vin && (
                    <div className="flex items-baseline gap-1.5 text-gray-600 min-w-0">
                      <span className="kicker shrink-0">VIN</span>
                      <span className="font-mono text-xs truncate text-gray-700">{vehicle.vin}</span>
                    </div>
                  )}
                  {vehicle.color && (
                    <div className="flex items-baseline gap-1.5 text-gray-600">
                      <span className="kicker shrink-0">{t('vehiclesPage.color')}</span>
                      <span>{vehicle.color}</span>
                    </div>
                  )}
                  {vehicle.purchase_price && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="kicker shrink-0">{t('vehiclesPage.purchase')}</span>
                      <span className="font-semibold text-gray-900 tabular-nums">{formatPriceUSD(vehicle)}</span>
                    </div>
                  )}
                  {(() => {
                    const b = roiBadge(roiByVehicle.get(vehicle.id))
                    return b && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="kicker shrink-0">{t('vehiclesPage.recovery')}</span>
                        <span className={`inline-flex items-center px-1.5 h-5 rounded-full text-xs font-bold tabular-nums ring-1 ${b.cls}`}>
                          {b.pct}%
                        </span>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Actions footer */}
              <div className="border-t border-gray-100 px-4 py-3 flex gap-2 bg-gray-50/60">
                <button
                  onClick={(e) => handleEdit(vehicle, e)}
                  className="cab-btn cab-btn-secondary cab-btn-sm flex-1"
                >
                  {t('vehiclesPage.edit')}
                </button>
                <button
                  onClick={(e) => handleDelete(vehicle.id, e)}
                  className="cab-btn cab-btn-ghost cab-btn-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {t('vehiclesPage.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Table (list mode) ── */
        <div className="cab-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {selectMode && <th className="table-header-cell w-10"></th>}
                  <th className="table-header-cell">{t('vehiclesPage.colVehicle')}</th>
                  <th className="table-header-cell hidden lg:table-cell">VIN</th>
                  <th className="table-header-cell hidden md:table-cell">{t('vehiclesPage.colStatus')}</th>
                  <th className="table-header-cell text-right hidden sm:table-cell">{t('vehiclesPage.colPurchasePrice')}</th>
                  <th className="table-header-cell text-right hidden md:table-cell">{t('vehiclesPage.recovery')}</th>
                  <th className="table-header-cell text-right">{t('vehiclesPage.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    onClick={() => selectMode ? toggleSelect(vehicle.id) : navigate(`/parts/vehicles/${vehicle.id}`)}
                    className={`table-row cursor-pointer ${selectMode && selectedIds.has(vehicle.id) ? 'bg-primary/5' : ''}`}
                  >
                    {selectMode && (
                      <td className="table-cell">
                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(vehicle.id) }} aria-label={t('vehiclesPage.select')}>
                          {selectedIds.has(vehicle.id)
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 text-gray-400" />}
                        </button>
                      </td>
                    )}
                    <td className="table-cell">
                      <p className="font-semibold text-gray-900">{vehicle.make} {vehicle.model}</p>
                      {vehicle.year && (
                        <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                          {vehicle.year}{vehicle.color ? ` · ${vehicle.color}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      {vehicle.vin
                        ? <span className="font-mono text-xs text-gray-600 max-w-[160px] block truncate">{vehicle.vin}</span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      <span className={statusBadge[vehicle.status]}>
                        {statusLabels[vehicle.status]}
                      </span>
                    </td>
                    <td className="table-cell hidden sm:table-cell text-right font-semibold text-gray-900 tabular-nums">
                      {formatPriceUSD(vehicle)}
                    </td>
                    <td className="table-cell hidden md:table-cell text-right">
                      {(() => {
                        const b = roiBadge(roiByVehicle.get(vehicle.id))
                        return b
                          ? <span className={`inline-flex items-center px-1.5 h-5 rounded-full text-xs font-bold tabular-nums ring-1 ${b.cls}`}>{b.pct}%</span>
                          : <span className="text-gray-400">—</span>
                      })()}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => handleEdit(vehicle, e)}
                          className="cab-btn cab-btn-ghost cab-btn-sm"
                        >
                          {t('vehiclesPage.change')}
                        </button>
                        <button
                          onClick={(e) => handleDelete(vehicle.id, e)}
                          className="cab-btn cab-btn-ghost cab-btn-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {t('vehiclesPage.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <PartsVehicleModal
          isOpen={isModalOpen}
          vehicle={selectedVehicle}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedVehicle(null)
          }}
          onSubmit={async (data) => {
            await saveMutation.mutateAsync(data)
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} />

      {/* ── Модалка импорта авто + запчастей ── */}
      {importOpen && (() => {
        const counts = plan
          ? {
              create: plan.filter(p => p.decision === 'create').length,
              update: plan.filter(p => p.decision === 'update').length,
              skip: plan.filter(p => p.decision === 'skip').length,
              parts: plan.filter(p => p.decision !== 'skip').reduce((s, p) => s + p.pv.parts.length, 0),
            }
          : { create: 0, update: 0, skip: 0, parts: 0 }
        const changedCount = plan?.filter(p => p.kind === 'changed').length ?? 0
        const close = () => { setImportOpen(false); setParsed(null); setPlan(null) }
        const reset = () => { setParsed(null); setPlan(null) }
        return (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-sheet sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">{t('vehiclesPage.importTitle')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('vehiclesPage.importSubtitle')}</p>
              </div>
              <button type="button" onClick={close} className="btn-icon btn-icon-sm ml-3 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {!parsed && !parsing ? (
                <>
                  <label className="block border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
                    />
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-gray-700">{t('vehiclesPage.importDrop')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('vehiclesPage.importHint')}</p>
                  </label>
                  <button onClick={() => downloadVehiclesTemplate()} className="cab-btn cab-btn-ghost cab-btn-sm w-full justify-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4" /> {t('vehiclesPage.template')}
                  </button>
                </>
              ) : parsing ? (
                <div className="py-10 flex justify-center"><Spinner size="md" /></div>
              ) : (
                <>
                  {/* Сводка плана */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="cab-card p-3 text-center">
                      <p className="kicker">{t('vehiclesPage.importCreate')}</p>
                      <p className="heading-3 tabular-nums text-emerald-600">{counts.create}</p>
                    </div>
                    <div className="cab-card p-3 text-center">
                      <p className="kicker">{t('vehiclesPage.importUpdate')}</p>
                      <p className="heading-3 tabular-nums text-amber-600">{counts.update}</p>
                    </div>
                    <div className="cab-card p-3 text-center">
                      <p className="kicker">{t('vehiclesPage.importSkip')}</p>
                      <p className="heading-3 tabular-nums text-gray-500">{counts.skip}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{t('vehiclesPage.importPartsAdd', { n: counts.parts })}</p>

                  {/* Изменённые — подтверждение */}
                  {changedCount > 0 && plan && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">{t('vehiclesPage.importChanged', { n: changedCount })}</p>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setAllChanged('update')} className="text-xs font-semibold text-primary hover:underline">{t('vehiclesPage.importUpdateAll')}</button>
                          <span className="text-gray-300">·</span>
                          <button onClick={() => setAllChanged('skip')} className="text-xs font-semibold text-gray-500 hover:underline">{t('vehiclesPage.importSkipAll')}</button>
                        </div>
                      </div>
                      <div className="max-h-56 overflow-auto space-y-2">
                        {plan.map((it, idx) => it.kind === 'changed' ? (
                          <div key={idx} className="rounded-lg border border-gray-200 p-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {it.pv.make} {it.pv.model}{it.pv.year ? ` ${it.pv.year}` : ''}
                              </span>
                              <div className="inline-flex rounded-lg overflow-hidden ring-1 ring-gray-200 text-xs flex-shrink-0">
                                <button onClick={() => setDecision(idx, 'update')} className={`px-2 py-1 font-medium ${it.decision === 'update' ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}>{t('vehiclesPage.importUpdate')}</button>
                                <button onClick={() => setDecision(idx, 'skip')} className={`px-2 py-1 font-medium ${it.decision === 'skip' ? 'bg-gray-200 text-gray-700' : 'bg-white text-gray-500'}`}>{t('vehiclesPage.importSkip')}</button>
                              </div>
                            </div>
                            {it.diffs.length > 0 && (
                              <div className="space-y-0.5">
                                {it.diffs.map((d, di) => (
                                  <div key={di} className="text-xs flex items-center gap-1.5">
                                    <span className="text-gray-400 w-20 flex-shrink-0">{d.label}</span>
                                    <span className="text-gray-400 line-through truncate max-w-[35%]">{d.from}</span>
                                    <span className="text-gray-300">→</span>
                                    <span className="font-medium text-gray-800 truncate">{d.to}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Изменённые запчасти этого авто */}
                            {it.partChanges.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                                <p className="kicker text-gray-400">{t('vehiclesPage.importPartChanges', { n: it.partChanges.length })}</p>
                                {it.partChanges.map((pc, pcIdx) => (
                                  <div key={pcIdx} className={`rounded-md bg-gray-50 p-1.5 ${it.decision === 'skip' || pc.decision === 'skip' ? 'opacity-50' : ''}`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-medium text-gray-700 truncate">{pc.name}</span>
                                      <div className="inline-flex rounded-md overflow-hidden ring-1 ring-gray-200 text-[10px] flex-shrink-0">
                                        <button onClick={() => setPartDecision(idx, pcIdx, 'update')} className={`px-1.5 py-0.5 font-medium ${pc.decision === 'update' ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}>{t('vehiclesPage.importUpdate')}</button>
                                        <button onClick={() => setPartDecision(idx, pcIdx, 'skip')} className={`px-1.5 py-0.5 font-medium ${pc.decision === 'skip' ? 'bg-gray-200 text-gray-700' : 'bg-white text-gray-500'}`}>{t('vehiclesPage.importSkip')}</button>
                                      </div>
                                    </div>
                                    {pc.diffs.map((d, di) => (
                                      <div key={di} className="text-[11px] flex items-center gap-1.5 mt-0.5">
                                        <span className="text-gray-400 w-14 flex-shrink-0">{d.label}</span>
                                        <span className="text-gray-400 line-through truncate max-w-[35%]">{d.from}</span>
                                        <span className="text-gray-300">→</span>
                                        <span className="font-medium text-gray-800 truncate">{d.to}</span>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                            {it.partAdds > 0 && (
                              <p className="text-xs text-emerald-600 mt-2">{t('vehiclesPage.importPartsNew', { n: it.partAdds })}</p>
                            )}
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
              {parsed && !parsing ? (
                <>
                  <button onClick={reset} className="cab-btn cab-btn-secondary flex-1">{t('vehiclesPage.importOther')}</button>
                  <button
                    onClick={() => importMutation.mutate()}
                    disabled={importMutation.isPending || (counts.create + counts.update === 0)}
                    className="cab-btn cab-btn-primary flex-1"
                  >
                    {importMutation.isPending ? t('vehiclesPage.importing') : t('vehiclesPage.importApply')}
                  </button>
                </>
              ) : (
                <button onClick={close} className="cab-btn cab-btn-secondary w-full justify-center">{t('vehiclesPage.cancel')}</button>
              )}
            </div>
          </div>
        </div>
        )
      })()}
      </div>
    </div>
  )
}
