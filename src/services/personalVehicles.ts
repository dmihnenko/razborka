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
 * Преобразование snake_case в camelCase для PersonalVehicle
 */
function transformVehicleFromDb(dbVehicle: any): PersonalVehicle {
  return {
    id: dbVehicle.id,
    userId: dbVehicle.user_id,
    makeModel: dbVehicle.make_model,
    year: dbVehicle.year,
    vin: dbVehicle.vin,
    photoUrl: dbVehicle.photo_url,
    usdRate: dbVehicle.usd_rate,
    lotItems: dbVehicle.lot_items || [],
    partsItems: dbVehicle.parts_items || [],
    workItems: dbVehicle.work_items || [],
    additionalItems: dbVehicle.additional_items || [],
    totalCost: dbVehicle.total_cost || 0,
    isSold: dbVehicle.is_sold,
    soldAt: dbVehicle.sold_at,
    salePrice: dbVehicle.sale_price,
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
function transformShareLinkFromDb(dbLink: any): VehicleShareLink {
  return {
    id: dbLink.id,
    code: dbLink.code,
    vehicleId: dbLink.vehicle_id,
    userId: dbLink.user_id,
    createdAt: dbLink.created_at,
    expiresAt: dbLink.expires_at,
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
  const updateData: any = {}

  if (input.makeModel !== undefined) updateData.make_model = input.makeModel
  if (input.year !== undefined) updateData.year = input.year
  if (input.vin !== undefined) updateData.vin = input.vin || null
  if (input.photoUrl !== undefined) updateData.photo_url = input.photoUrl || null
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
  const categoryFieldSnake = `${category}_items`
  const categoryFieldCamel = `${category}Items`

  // Получить текущие расходы
  const { data: vehicle, error: fetchError } = await supabase
    .from('personal_vehicles')
    .select(categoryFieldSnake)
    .eq('id', vehicleId)
    .single()

  if (fetchError) throw fetchError

  const currentItems = (vehicle as any)[categoryFieldSnake] || []
  const updatedItems = [...currentItems, item]

  // Обновить расходы
  await updatePersonalVehicle(vehicleId, {
    [categoryFieldCamel]: updatedItems
  } as any)
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
  const categoryFieldSnake = `${category}_items`
  const categoryFieldCamel = `${category}Items`

  // Получить текущие расходы
  const { data: vehicle, error: fetchError } = await supabase
    .from('personal_vehicles')
    .select(categoryFieldSnake)
    .eq('id', vehicleId)
    .single()

  if (fetchError) throw fetchError

  const currentItems = (vehicle as any)[categoryFieldSnake] || []
  const updatedItems = currentItems.map((item: PersonalCostItem) =>
    item.id === itemId ? updatedItem : item
  )

  // Обновить расходы
  await updatePersonalVehicle(vehicleId, {
    [categoryFieldCamel]: updatedItems
  } as any)
}

/**
 * Удалить расход из категории
 */
export async function deleteExpenseItem(
  vehicleId: string,
  category: CostCategory,
  itemId: string
): Promise<void> {
  const categoryFieldSnake = `${category}_items`
  const categoryFieldCamel = `${category}Items`

  // Получить текущие расходы
  const { data: vehicle, error: fetchError } = await supabase
    .from('personal_vehicles')
    .select(categoryFieldSnake)
    .eq('id', vehicleId)
    .single()

  if (fetchError) throw fetchError

  const currentItems = (vehicle as any)[categoryFieldSnake] || []
  const updatedItems = currentItems.filter((item: PersonalCostItem) => item.id !== itemId)

  // Обновить расходы
  await updatePersonalVehicle(vehicleId, {
    [categoryFieldCamel]: updatedItems
  } as any)
}

/**
 * Маппинг PhotoAlbum → имя колонки в БД
 */
const ALBUM_COLUMN: Record<PhotoAlbum, string> = {
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
    .single()

  if (fetchError) throw fetchError

  const currentPhotos = (vehicle as any)[col] || []
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
    .single()

  if (fetchError) throw fetchError

  const currentPhotos = (vehicle as any)[col] || []
  const updatedPhotos = currentPhotos.filter((_: any, index: number) => index !== photoIndex)

  // Обновить фото
  const { error } = await supabase
    .from('personal_vehicles')
    .update({ [col]: updatedPhotos })
    .eq('id', vehicleId)

  if (error) throw error
}

/**
 * Создать код доступа
 */
export async function createVehicleShareLink(
  vehicleId: string,
  userId: string,
  expiresInDays?: number
): Promise<VehicleShareLink> {
  // Генерировать уникальный 4-значный код
  let code: string
  let isUnique = false

  while (!isUnique) {
    code = String(Math.floor(1000 + Math.random() * 9000))

    const { data } = await supabase
      .from('vehicle_share_links')
      .select('id')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()

    isUnique = !data
  }

  const linkData: any = {
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
  const { data, error } = await supabase
    .from('vehicle_share_links')
    .select('vehicle_id, expires_at')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null

  // Проверить срок действия
  if (data.expires_at) {
    const expiresAt = new Date(data.expires_at)
    if (expiresAt < new Date()) {
      return null
    }
  }

  return data.vehicle_id
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
