import { supabase } from '@/lib/supabase'
import type {
  PersonalVehicle,
  PersonalCostItem,
  VehicleShareLink,
  CreatePersonalVehicleInput,
  UpdatePersonalVehicleInput,
  VehiclePhoto,
  PhotoAlbum,
  CostCategory
} from '@/types/personalVehicles'

/**
 * Форма строки personal_vehicles из БД (snake_case, как приходит из supabase)
 */
interface PersonalVehicleRow {
  id: string
  user_id: string
  make_model: string
  year: number
  vin: string | null
  photo_url: string | null
  carfax_url: string | null
  usd_rate: number | null
  lot_items: PersonalCostItem[] | null
  parts_items: PersonalCostItem[] | null
  work_items: PersonalCostItem[] | null
  additional_items: PersonalCostItem[] | null
  total_cost: number | null
  is_sold: boolean
  sold_at: string | null
  sale_price: number | null
  usa_photos: VehiclePhoto[] | null
  port_photos: VehiclePhoto[] | null
  arrival_photos: VehiclePhoto[] | null
  created_at: string
  updated_at: string
}

/**
 * Форма строки vehicle_share_links из БД (snake_case)
 */
interface VehicleShareLinkRow {
  id: string
  code: string
  vehicle_id: string
  user_id: string
  created_at: string
  expires_at: string | null
  is_active: boolean
}

/** Частичный snake_case-апдейт для personal_vehicles */
type PersonalVehicleUpdate = Partial<Omit<PersonalVehicleRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

/** Частичный snake_case-набор для insert vehicle_share_links */
type VehicleShareLinkInsert = {
  code: string
  vehicle_id: string
  user_id: string
  is_active: boolean
  expires_at?: string
}

/**
 * Преобразование snake_case в camelCase для PersonalVehicle
 */
function transformVehicleFromDb(dbVehicle: PersonalVehicleRow): PersonalVehicle {
  return {
    id: dbVehicle.id,
    userId: dbVehicle.user_id,
    makeModel: dbVehicle.make_model,
    year: dbVehicle.year,
    // БД отдаёт null для незаполненных; домен — опциональные (undefined). Коэрсим
    // null → undefined (truthy-проверки у потребителей идентичны).
    vin: dbVehicle.vin ?? undefined,
    photoUrl: dbVehicle.photo_url ?? undefined,
    carfaxUrl: dbVehicle.carfax_url ?? undefined,
    usdRate: dbVehicle.usd_rate ?? undefined,
    lotItems: dbVehicle.lot_items || [],
    partsItems: dbVehicle.parts_items || [],
    workItems: dbVehicle.work_items || [],
    additionalItems: dbVehicle.additional_items || [],
    totalCost: dbVehicle.total_cost || 0,
    isSold: dbVehicle.is_sold,
    soldAt: dbVehicle.sold_at ?? undefined,
    salePrice: dbVehicle.sale_price ?? undefined,
    usaPhotos: dbVehicle.usa_photos || [],
    portPhotos: dbVehicle.port_photos || [],
    arrivalPhotos: dbVehicle.arrival_photos || [],
    createdAt: dbVehicle.created_at,
    updatedAt: dbVehicle.updated_at
  }
}

/**
 * Преобразование snake_case в camelCase для VehicleShareLink
 */
function transformShareLinkFromDb(dbLink: VehicleShareLinkRow): VehicleShareLink {
  return {
    id: dbLink.id,
    code: dbLink.code,
    vehicleId: dbLink.vehicle_id,
    userId: dbLink.user_id,
    createdAt: dbLink.created_at,
    expiresAt: dbLink.expires_at ?? undefined,
    isActive: dbLink.is_active
  }
}

/**
 * Расчет общей стоимости автомобиля в USD
 */
export function calculatePersonalTotalCost(vehicle: Partial<PersonalVehicle>): number {
  const usdRate = vehicle.usdRate || 1

  const categories = [
    vehicle.lotItems || [],
    vehicle.partsItems || [],
    vehicle.workItems || [],
    vehicle.additionalItems || []
  ]

  return categories.reduce((total, items) => {
    const categoryTotal = items.reduce((sum, item) => {
      const usdValue = item.currency === 'USD' ? item.cost : item.cost / usdRate
      return sum + usdValue
    }, 0)
    return total + categoryTotal
  }, 0)
}

/**
 * Получить все автомобили пользователя
 */
export async function getPersonalVehicles(
  userId: string,
  includeSold = false
): Promise<PersonalVehicle[]> {
  let query = supabase
    .from('personal_vehicles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!includeSold) {
    query = query.eq('is_sold', false)
  }

  const { data, error } = await query

  if (error) throw error
  
  // Преобразуем и пересчитываем total_cost для каждого автомобиля
  return (data || []).map(dbVehicle => {
    const vehicle = transformVehicleFromDb(dbVehicle)
    vehicle.totalCost = calculatePersonalTotalCost(vehicle)
    return vehicle
  })
}

/**
 * Получить автомобиль по ID
 */
export async function getPersonalVehicleById(id: string): Promise<PersonalVehicle | null> {
  const { data, error } = await supabase
    .from('personal_vehicles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return transformVehicleFromDb(data)
}

/**
 * Создать новый автомобиль
 */
export async function createPersonalVehicle(
  userId: string,
  input: CreatePersonalVehicleInput
): Promise<string> {
  const vehicleData = {
    user_id: userId,
    make_model: input.makeModel,
    carfax_url: input.carfaxUrl || null,
    year: input.year,
    vin: input.vin || null,
    photo_url: input.photoUrl || null,
    usd_rate: input.usdRate || null,
    lot_items: [],
    parts_items: [],
    work_items: [],
    additional_items: [],
    total_cost: 0,
    is_sold: false,
    usa_photos: [],
    port_photos: [],
    arrival_photos: []
  }

  const { data, error } = await supabase
    .from('personal_vehicles')
    .insert(vehicleData)
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

/**
 * Обновить автомобиль
 */
export async function updatePersonalVehicle(
  id: string,
  input: UpdatePersonalVehicleInput
): Promise<void> {
  const updateData: PersonalVehicleUpdate = {}

  if (input.makeModel !== undefined) updateData.make_model = input.makeModel
  if (input.year !== undefined) updateData.year = input.year
  if (input.vin !== undefined) updateData.vin = input.vin || null
  if (input.photoUrl !== undefined) updateData.photo_url = input.photoUrl || null
  if (input.carfaxUrl !== undefined) updateData.carfax_url = input.carfaxUrl || null
  if (input.usdRate !== undefined) updateData.usd_rate = input.usdRate || null
  if (input.lotItems !== undefined) updateData.lot_items = input.lotItems
  if (input.partsItems !== undefined) updateData.parts_items = input.partsItems
  if (input.workItems !== undefined) updateData.work_items = input.workItems
  if (input.additionalItems !== undefined) updateData.additional_items = input.additionalItems
  if (input.isSold !== undefined) updateData.is_sold = input.isSold
  if (input.soldAt !== undefined) updateData.sold_at = input.soldAt || null
  if (input.salePrice !== undefined) updateData.sale_price = input.salePrice || null

  // Пересчитать total_cost если изменились расходы
  if (input.lotItems || input.partsItems || input.workItems || input.additionalItems || input.usdRate !== undefined) {
    const { data: currentVehicle } = await supabase
      .from('personal_vehicles')
      .select('*')
      .eq('id', id)
      .single()

    if (currentVehicle) {
      const updatedVehicle = {
        ...currentVehicle,
        ...updateData
      }
      updateData.total_cost = calculatePersonalTotalCost(updatedVehicle as PersonalVehicle)
    }
  }

  const { error } = await supabase
    .from('personal_vehicles')
    .update(updateData)
    .eq('id', id)

  if (error) throw error
}

/**
 * Удалить автомобиль
 */
export async function deletePersonalVehicle(id: string): Promise<void> {
  const { error } = await supabase
    .from('personal_vehicles')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Добавить расход в категорию
 */
export async function addExpenseItem(
  vehicleId: string,
  category: CostCategory,
  item: PersonalCostItem
): Promise<void> {
  const categoryFieldSnake = `${category}_items` as const
  const categoryFieldCamel = `${category}Items` as const

  // Получить текущие расходы
  const { data: vehicle, error: fetchError } = await supabase
    .from('personal_vehicles')
    .select(categoryFieldSnake)
    .eq('id', vehicleId)
    .single<Partial<Record<typeof categoryFieldSnake, PersonalCostItem[] | null>>>()

  if (fetchError) throw fetchError

  const currentItems = vehicle?.[categoryFieldSnake] || []
  const updatedItems = [...currentItems, item]

  // Обновить расходы
  const update: UpdatePersonalVehicleInput = {}
  update[categoryFieldCamel] = updatedItems
  await updatePersonalVehicle(vehicleId, update)
}

/**
 * Обновить расход в категории
 */
export async function updateExpenseItem(
  vehicleId: string,
  category: CostCategory,
  itemId: string,
  updatedItem: PersonalCostItem
): Promise<void> {
  const categoryFieldSnake = `${category}_items` as const
  const categoryFieldCamel = `${category}Items` as const

  // Получить текущие расходы
  const { data: vehicle, error: fetchError } = await supabase
    .from('personal_vehicles')
    .select(categoryFieldSnake)
    .eq('id', vehicleId)
    .single<Partial<Record<typeof categoryFieldSnake, PersonalCostItem[] | null>>>()

  if (fetchError) throw fetchError

  const currentItems = vehicle?.[categoryFieldSnake] || []
  const updatedItems = currentItems.map((item) =>
    item.id === itemId ? updatedItem : item
  )

  // Обновить расходы
  const update: UpdatePersonalVehicleInput = {}
  update[categoryFieldCamel] = updatedItems
  await updatePersonalVehicle(vehicleId, update)
}

/**
 * Удалить расход из категории
 */
export async function deleteExpenseItem(
  vehicleId: string,
  category: CostCategory,
  itemId: string
): Promise<void> {
  const categoryFieldSnake = `${category}_items` as const
  const categoryFieldCamel = `${category}Items` as const

  // Получить текущие расходы
  const { data: vehicle, error: fetchError } = await supabase
    .from('personal_vehicles')
    .select(categoryFieldSnake)
    .eq('id', vehicleId)
    .single<Partial<Record<typeof categoryFieldSnake, PersonalCostItem[] | null>>>()

  if (fetchError) throw fetchError

  const currentItems = vehicle?.[categoryFieldSnake] || []
  const updatedItems = currentItems.filter((item) => item.id !== itemId)

  // Обновить расходы
  const update: UpdatePersonalVehicleInput = {}
  update[categoryFieldCamel] = updatedItems
  await updatePersonalVehicle(vehicleId, update)
}

/**
 * Маппинг PhotoAlbum → имя колонки в БД
 */
type PhotoColumn = 'usa_photos' | 'port_photos' | 'arrival_photos'

const ALBUM_COLUMN: Record<PhotoAlbum, PhotoColumn> = {
  usaPhotos: 'usa_photos',
  portPhotos: 'port_photos',
  arrivalPhotos: 'arrival_photos',
}

/**
 * Добавить фото в альбом
 */
export async function addVehiclePhoto(
  vehicleId: string,
  album: PhotoAlbum,
  photo: VehiclePhoto
): Promise<void> {
  const col = ALBUM_COLUMN[album]

  // Получить текущие фото
  const { data: vehicle, error: fetchError } = await supabase
    .from('personal_vehicles')
    .select(col)
    .eq('id', vehicleId)
    .single<Partial<Record<PhotoColumn, VehiclePhoto[] | null>>>()

  if (fetchError) throw fetchError

  const currentPhotos = vehicle?.[col] || []
  const updatedPhotos = [...currentPhotos, photo]

  // Обновить фото
  const { error } = await supabase
    .from('personal_vehicles')
    .update({ [col]: updatedPhotos })
    .eq('id', vehicleId)

  if (error) throw error
}

/**
 * Удалить фото из альбома
 */
export async function deleteVehiclePhoto(
  vehicleId: string,
  album: PhotoAlbum,
  photoIndex: number
): Promise<void> {
  const col = ALBUM_COLUMN[album]

  // Получить текущие фото
  const { data: vehicle, error: fetchError } = await supabase
    .from('personal_vehicles')
    .select(col)
    .eq('id', vehicleId)
    .single<Partial<Record<PhotoColumn, VehiclePhoto[] | null>>>()

  if (fetchError) throw fetchError

  const currentPhotos = vehicle?.[col] || []
  const updatedPhotos = currentPhotos.filter((_: VehiclePhoto, index: number) => index !== photoIndex)

  // Обновить фото
  const { error } = await supabase
    .from('personal_vehicles')
    .update({ [col]: updatedPhotos })
    .eq('id', vehicleId)

  if (error) throw error
}

// Алфавит кода доступа — без неоднозначных символов (I, O, 0, 1, L).
const SHARE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // 31 символ
const SHARE_CODE_LEN = 8

/**
 * Криптостойкий код доступа (8 симв., ~31^8 ≈ 8.5·10¹¹ вариантов).
 * Старый код был 4 цифры (9000 вариантов) — перебирался через анонимный RPC за секунды.
 * Длинный код делает перебор бессмысленным без всякого rate-limit.
 */
function generateShareCode(): string {
  const bytes = new Uint8Array(SHARE_CODE_LEN)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < SHARE_CODE_LEN; i++) {
    out += SHARE_CODE_ALPHABET[bytes[i] % SHARE_CODE_ALPHABET.length]
  }
  return out
}

/**
 * Создать код доступа
 */
export async function createVehicleShareLink(
  vehicleId: string,
  userId: string,
  expiresInDays?: number
): Promise<VehicleShareLink> {
  // Генерировать уникальный криптостойкий код
  let code: string
  let isUnique = false

  while (!isUnique) {
    code = generateShareCode()

    // Глобальная уникальность кода проверяется через SECURITY DEFINER RPC:
    // владелец напрямую видит только свои коды, поэтому проверку делает функция.
    const { data: taken } = await supabase.rpc('vehicle_share_code_taken', { p_code: code })

    isUnique = !taken
  }

  const linkData: VehicleShareLinkInsert = {
    code: code!,
    vehicle_id: vehicleId,
    user_id: userId,
    is_active: true
  }

  if (expiresInDays) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    linkData.expires_at = expiresAt.toISOString()
  }

  const { data, error } = await supabase
    .from('vehicle_share_links')
    .insert(linkData)
    .select()
    .single()

  if (error) throw error
  return transformShareLinkFromDb(data)
}

/**
 * Получить все коды доступа для автомобиля
 */
export async function getVehicleShareLinks(vehicleId: string): Promise<VehicleShareLink[]> {
  const { data, error } = await supabase
    .from('vehicle_share_links')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(transformShareLinkFromDb)
}

/**
 * Деактивировать код доступа
 */
export async function deactivateVehicleShareLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('vehicle_share_links')
    .update({ is_active: false })
    .eq('id', linkId)

  if (error) throw error
}

/**
 * Валидация кода доступа (возвращает ID автомобиля или null)
 */
export async function validateVehicleShareCode(code: string): Promise<string | null> {
  // Нормализуем: новый код — заглавные A–Z/2–9; старый 4-значный числовой не меняется.
  const normalized = code.trim().toUpperCase()
  // Резолв через SECURITY DEFINER RPC: таблица кодов не читается напрямую (anon её
  // больше не видит). RPC проверяет is_active + срок.
  const { data, error } = await supabase.rpc('validate_vehicle_share_code', { p_code: normalized })
  if (error || !data) return null
  return data as string
}

/**
 * Отметить автомобиль как проданный
 */
export async function markVehicleAsSold(
  vehicleId: string,
  salePrice: number
): Promise<void> {
  await updatePersonalVehicle(vehicleId, {
    isSold: true,
    soldAt: new Date().toISOString(),
    salePrice
  })
}
