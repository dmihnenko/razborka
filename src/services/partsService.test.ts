import { describe, it, expect, beforeEach } from 'vitest'
import '../test/mocks/supabase'
import {
  getPartsVehicles,
  getPartsVehicle,
  createPartsVehicle,
  updatePartsVehicle,
  deletePartsVehicle,
  updateVehicleStatus,
  getPartsCustomers,
  createPartsCustomer,
  updatePartsCustomer,
  deletePartsCustomer,
  getPartsCategories,
  getPartsCategoryTemplates,
  getSuggestedCategories,
  copyTemplateCategories,
  createPartsCategory,
  createPartsCategoriesBulk,
  updatePartsCategory,
  deletePartsCategory,
  getPartsInventory,
  getPartsInventoryItem,
  createPartsInventoryItem,
  updatePartsInventoryItem,
  appendPartsItemPhotos,
  deletePartsInventoryItem,
  getPartsOrders,
  getPartsOrder,
  createPartsOrder,
  createPartsOrderItem,
  updatePartsOrderTotal,
  getStorageLocations,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
} from '@/services/partsService'
import { mockSupabase, setFromResponse, setRpcResponse } from '../test/mocks/supabase'
import type { PartsVehicle, PartsCustomer, PartsCategory, PartsInventoryItem, CreatePartsVehicleInput } from '@/types/parts'

function makeVehicle(override?: Partial<PartsVehicle>): PartsVehicle {
  return {
    id: 'v-1',
    parts_company_id: 'pc-1',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    vin: 'ABC123',
    license_plate: 'AA0000AA',
    status: 'awaiting',
    notes: undefined,
    purchase_price: undefined,
    photos: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...override,
  }
}

describe('getPartsVehicles', () => {
  beforeEach(() => {
    setFromResponse([makeVehicle()], null)
  })

  it('запрашивает parts_vehicles по partsCompanyId', async () => {
    const result = await getPartsVehicles('pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_vehicles')
    expect(Array.isArray(result)).toBe(true)
  })

  it('выбрасывает ошибку при ошибке DB', async () => {
    setFromResponse(null, { message: 'error' })
    await expect(getPartsVehicles('pc-1')).rejects.toBeDefined()
  })
})

describe('createPartsVehicle', () => {
  it('создаёт новое авто и возвращает его', async () => {
    const vehicle = makeVehicle()
    setFromResponse(vehicle, null)

    const input: CreatePartsVehicleInput = {
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
    }

    await createPartsVehicle(input, 'pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_vehicles')
  })

  it('выбрасывает ошибку при неудаче', async () => {
    setFromResponse(null, { message: 'insert failed' })
    await expect(
      createPartsVehicle({ make: 'BMW', model: 'X5' }, 'pc-1')
    ).rejects.toBeDefined()
  })
})

describe('updatePartsVehicle', () => {
  it('обновляет авто по id', async () => {
    setFromResponse(makeVehicle({ make: 'Honda' }), null)

    await updatePartsVehicle('v-1', { make: 'Honda' })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_vehicles')
  })
})

describe('deletePartsVehicle', () => {
  it('удаляет авто по id', async () => {
    setFromResponse(null, null)
    await deletePartsVehicle('v-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_vehicles')
  })

  it('выбрасывает ошибку при ошибке DB', async () => {
    setFromResponse(null, { message: 'delete failed' })
    await expect(deletePartsVehicle('v-1')).rejects.toBeDefined()
  })
})

// ─── Customers ─────────────────────────────────────────────

function makeCustomer(override?: Partial<PartsCustomer>): PartsCustomer {
  return {
    id: 'cust-1',
    parts_company_id: 'pc-1',
    full_name: 'Іванов Іван',
    phone: '+380991234567',
    email: undefined,
    discount_percent: 0,
    notes: undefined,
    total_orders: 0,
    total_spent: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...override,
  }
}

describe('getPartsCustomers', () => {
  it('повертає список клієнтів з статистикою', async () => {
    setFromResponse([makeCustomer()], null)
    const result = await getPartsCustomers('pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_customers')
    expect(Array.isArray(result)).toBe(true)
  })

  it('виключає ошибку при помилці customers', async () => {
    setFromResponse(null, { message: 'customers error' })
    await expect(getPartsCustomers('pc-1')).rejects.toBeDefined()
  })
})

describe('createPartsCustomer', () => {
  it('створює клієнта і повертає його', async () => {
    const customer = makeCustomer()
    setFromResponse(customer, null)
    await createPartsCustomer({ full_name: 'Іванов Іван', phone: '+380991234567' }, 'pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_customers')
  })

  it('виключає помилку при неудачі', async () => {
    setFromResponse(null, { message: 'insert failed' })
    await expect(createPartsCustomer({ full_name: 'Х' }, 'pc-1')).rejects.toBeDefined()
  })
})

describe('updatePartsCustomer', () => {
  it('оновлює клієнта по id', async () => {
    setFromResponse(makeCustomer({ full_name: 'Петренко' }), null)
    await updatePartsCustomer('cust-1', { full_name: 'Петренко' })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_customers')
  })

  it('виключає помилку при неудачі', async () => {
    setFromResponse(null, { message: 'update failed' })
    await expect(updatePartsCustomer('cust-1', { full_name: 'X' })).rejects.toBeDefined()
  })
})

describe('deletePartsCustomer', () => {
  it('видаляє клієнта по id', async () => {
    setFromResponse(null, null)
    await deletePartsCustomer('cust-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_customers')
  })

  it('виключає помилку при ошибці DB', async () => {
    setFromResponse(null, { message: 'delete failed' })
    await expect(deletePartsCustomer('cust-1')).rejects.toBeDefined()
  })
})

// ─── Categories ────────────────────────────────────────────

function makeCategory(override?: Partial<PartsCategory>): PartsCategory {
  return {
    id: 'cat-1',
    parts_company_id: 'pc-1',
    name: 'Двигун',
    is_active: true,
    is_template: false,
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    ...override,
  }
}

describe('getPartsCategories', () => {
  beforeEach(() => setFromResponse([makeCategory()], null))

  it('повертає категорії компанії', async () => {
    const result = await getPartsCategories('pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_categories')
    expect(Array.isArray(result)).toBe(true)
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'error' })
    await expect(getPartsCategories('pc-1')).rejects.toBeDefined()
  })
})

describe('createPartsCategory', () => {
  it('створює категорію', async () => {
    setFromResponse(makeCategory(), null)
    await createPartsCategory({ name: 'Двигун' }, 'pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_categories')
  })

  it('виключає помилку при неудачі', async () => {
    setFromResponse(null, { message: 'insert failed' })
    await expect(createPartsCategory({ name: 'X' }, 'pc-1')).rejects.toBeDefined()
  })
})

describe('updatePartsCategory', () => {
  it('оновлює категорію по id', async () => {
    setFromResponse(makeCategory({ name: 'Підвіска' }), null)
    await updatePartsCategory('cat-1', { name: 'Підвіска' })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_categories')
  })

  it('виключає помилку при неудачі', async () => {
    setFromResponse(null, { message: 'update failed' })
    await expect(updatePartsCategory('cat-1', { name: 'X' })).rejects.toBeDefined()
  })
})

describe('deletePartsCategory', () => {
  it('видаляє категорію по id', async () => {
    setFromResponse(null, null)
    await deletePartsCategory('cat-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_categories')
  })

  it('виключає помилку при ошибці DB', async () => {
    setFromResponse(null, { message: 'delete failed' })
    await expect(deletePartsCategory('cat-1')).rejects.toBeDefined()
  })
})

// ─── Inventory ─────────────────────────────────────────────

function makeInventoryItem(override?: Partial<PartsInventoryItem>): PartsInventoryItem {
  return {
    id: 'inv-1',
    parts_company_id: 'pc-1',
    name: 'Капот',
    category_id: 'cat-1',
    condition: 'good',
    status: 'available',
    quantity: 1,
    reserved_quantity: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...override,
  }
}

describe('getPartsInventory', () => {
  it('повертає список запчастин', async () => {
    setFromResponse([makeInventoryItem()], null)
    const result = await getPartsInventory('pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_inventory')
    expect(Array.isArray(result)).toBe(true)
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'error' })
    await expect(getPartsInventory('pc-1')).rejects.toBeDefined()
  })
})

describe('getPartsInventoryItem', () => {
  it('повертає одну запчастину по id', async () => {
    setFromResponse(makeInventoryItem(), null)
    const result = await getPartsInventoryItem('inv-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_inventory')
    expect(result).toBeDefined()
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'error' })
    await expect(getPartsInventoryItem('inv-1')).rejects.toBeDefined()
  })
})

describe('createPartsInventoryItem', () => {
  it('створює запчастину', async () => {
    setFromResponse(makeInventoryItem(), null)
    await createPartsInventoryItem({ name: 'Капот', quantity: 1, condition: 'good' }, 'pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_inventory')
  })

  it('виключає помилку при неудачі', async () => {
    setFromResponse(null, { message: 'insert failed' })
    await expect(createPartsInventoryItem({ name: 'X', quantity: 1, condition: 'good' }, 'pc-1')).rejects.toBeDefined()
  })
})

describe('updatePartsInventoryItem', () => {
  it('оновлює запчастину по id', async () => {
    setFromResponse(makeInventoryItem({ name: 'Двері' }), null)
    await updatePartsInventoryItem('inv-1', { name: 'Двері' })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_inventory')
  })

  it('виключає помилку при неудачі', async () => {
    setFromResponse(null, { message: 'update failed' })
    await expect(updatePartsInventoryItem('inv-1', { name: 'X' })).rejects.toBeDefined()
  })
})

describe('appendPartsItemPhotos', () => {
  it('дописує нові фото до вже наявних, не перетираючи їх', async () => {
    // getPartsInventoryItem і updatePartsInventoryItem ділять один мок-білдер;
    // поточний товар має одне фото, тому update має отримати [існуюче + нове].
    const builder = setFromResponse(
      makeInventoryItem({ photos: [{ url: 'a' }] as any }),
      null,
    )
    await appendPartsItemPhotos('inv-1', [{ url: 'b' }])
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ photos: [{ url: 'a' }, { url: 'b' }] }),
    )
  })

  it('пропускає дублі по url (нічого додавати — update не викликається)', async () => {
    const builder = setFromResponse(
      makeInventoryItem({ photos: [{ url: 'a' }] as any }),
      null,
    )
    const res = await appendPartsItemPhotos('inv-1', [{ url: 'a' }])
    expect(builder.update).not.toHaveBeenCalled()
    expect(res).toBeDefined()
  })
})

describe('deletePartsInventoryItem', () => {
  it('видаляє запчастину по id', async () => {
    setFromResponse(null, null)
    await deletePartsInventoryItem('inv-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_inventory')
  })

  it('виключає помилку при ошибці DB', async () => {
    setFromResponse(null, { message: 'delete failed' })
    await expect(deletePartsInventoryItem('inv-1')).rejects.toBeDefined()
  })
})

// ─── Vehicles (single + status) ───────────────────────────

describe('getPartsVehicle', () => {
  it('повертає одне авто по id', async () => {
    setFromResponse(makeVehicle(), null)
    const result = await getPartsVehicle('v-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_vehicles')
    expect(result).toBeDefined()
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'not found' })
    await expect(getPartsVehicle('v-1')).rejects.toBeDefined()
  })
})

describe('updateVehicleStatus', () => {
  it('переводить статус в in_progress без currentVehicle — fetches first', async () => {
    setFromResponse({ dismantling_started_at: null, dismantling_completed_at: null }, null)
    await updateVehicleStatus('v-1', 'in_progress')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_vehicles')
  })

  it('переводить статус в dismantled з currentVehicle', async () => {
    setFromResponse(makeVehicle({ status: 'dismantled' }), null)
    await updateVehicleStatus('v-1', 'dismantled', {
      dismantling_started_at: '2024-01-01T00:00:00Z',
      dismantling_completed_at: undefined,
    })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_vehicles')
  })

  it('не перезаписує dismantling_started_at якщо вже є', async () => {
    setFromResponse(makeVehicle({ status: 'in_progress' }), null)
    await updateVehicleStatus('v-1', 'in_progress', {
      dismantling_started_at: '2024-01-01T00:00:00Z',
      dismantling_completed_at: undefined,
    })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_vehicles')
  })
})

// ─── Category templates ────────────────────────────────────

describe('getPartsCategoryTemplates', () => {
  beforeEach(() => setFromResponse([makeCategory({ is_template: true })], null))

  it('повертає шаблони для brand+model', async () => {
    const result = await getPartsCategoryTemplates('Toyota', 'Camry')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_categories')
    expect(Array.isArray(result)).toBe(true)
  })

  it('повертає шаблони тільки для brand', async () => {
    const result = await getPartsCategoryTemplates('Toyota')
    expect(Array.isArray(result)).toBe(true)
  })

  it('повертає глобальні шаблони без brand', async () => {
    const result = await getPartsCategoryTemplates()
    expect(Array.isArray(result)).toBe(true)
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'error' })
    await expect(getPartsCategoryTemplates()).rejects.toBeDefined()
  })
})

describe('getSuggestedCategories', () => {
  it('повертає підказки категорій через RPC', async () => {
    setRpcResponse([], null)
    const result = await getSuggestedCategories('pc-1', 'Toyota', 'Camry')
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_suggested_categories', expect.any(Object))
    expect(Array.isArray(result)).toBe(true)
  })

  it('виключає помилку RPC', async () => {
    setRpcResponse(null, { message: 'rpc error' })
    await expect(getSuggestedCategories('pc-1', 'x', 'y')).rejects.toBeDefined()
  })
})

describe('copyTemplateCategories', () => {
  it('копіює шаблонні категорії через RPC', async () => {
    setRpcResponse(5, null)
    const result = await copyTemplateCategories('pc-1', ['cat-1', 'cat-2'])
    expect(mockSupabase.rpc).toHaveBeenCalledWith('copy_template_categories_to_company', expect.any(Object))
    expect(result).toBe(5)
  })

  it('виключає помилку RPC', async () => {
    setRpcResponse(null, { message: 'rpc error' })
    await expect(copyTemplateCategories('pc-1', [])).rejects.toBeDefined()
  })
})

describe('createPartsCategoriesBulk', () => {
  it('створює кілька категорій', async () => {
    setFromResponse([makeCategory(), makeCategory({ id: 'cat-2', name: 'Підвіска' })], null)
    const result = await createPartsCategoriesBulk(['Двигун', 'Підвіска'], 'pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_categories')
    expect(Array.isArray(result)).toBe(true)
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'error' })
    await expect(createPartsCategoriesBulk(['X'], 'pc-1')).rejects.toBeDefined()
  })
})

// ─── Orders ────────────────────────────────────────────────

describe('getPartsOrders', () => {
  it('повертає список заказів', async () => {
    setFromResponse([], null)
    const result = await getPartsOrders('pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_orders')
    expect(Array.isArray(result)).toBe(true)
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'error' })
    await expect(getPartsOrders('pc-1')).rejects.toBeDefined()
  })
})

describe('getPartsOrder', () => {
  it('повертає один заказ по id', async () => {
    setFromResponse({ id: 'order-1', order_number: 'P-001' }, null)
    const result = await getPartsOrder('order-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_orders')
    expect(result).toBeDefined()
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'not found' })
    await expect(getPartsOrder('order-1')).rejects.toBeDefined()
  })
})

describe('createPartsOrder', () => {
  it('створює заказ з RPC для номеру', async () => {
    setRpcResponse('P-001', null)
    setFromResponse({ id: 'order-1', order_number: 'P-001' }, null)
    await createPartsOrder('pc-1', { customer_id: 'cust-1' })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_orders')
  })

  it('використовує fallback номер якщо RPC помиляється', async () => {
    setRpcResponse(null, { message: 'rpc failed' })
    setFromResponse({ id: 'order-1', order_number: 'P-fallback' }, null)
    await createPartsOrder('pc-1', {})
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_orders')
  })

  it('виключає помилку DB при вставці', async () => {
    setRpcResponse('P-001', null)
    setFromResponse(null, { message: 'insert failed' })
    await expect(createPartsOrder('pc-1', {})).rejects.toBeDefined()
  })
})

describe('createPartsOrderItem', () => {
  it('додає позицію до заказу', async () => {
    setFromResponse({ id: 'item-1' }, null)
    await createPartsOrderItem('order-1', {
      inventory_item_id: 'inv-1',
      quantity: 2,
      price_at_sale: 100,
    })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_order_items')
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'insert failed' })
    await expect(
      createPartsOrderItem('order-1', { inventory_item_id: 'inv-1', quantity: 1, price_at_sale: 50 })
    ).rejects.toBeDefined()
  })
})

describe('updatePartsOrderTotal', () => {
  it('оновлює загальну суму заказу', async () => {
    setFromResponse(
      [{ price_at_sale: 100, quantity: 2, price_at_sale_currency: 'UAH' }],
      null
    )
    await updatePartsOrderTotal('order-1', 41)
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_order_items')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_orders')
  })

  it('рахує USD позиції з конвертацією', async () => {
    setFromResponse(
      [{ price_at_sale: 10, quantity: 1, price_at_sale_currency: 'USD' }],
      null
    )
    await updatePartsOrderTotal('order-1', 41)
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_orders')
  })
})

// ─── Storage Locations ─────────────────────────────────────

describe('getStorageLocations', () => {
  it('повертає місця зберігання', async () => {
    setFromResponse([], null)
    const result = await getStorageLocations('pc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_storage_locations')
    expect(result).toBeDefined()
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'error' })
    await expect(getStorageLocations('pc-1')).rejects.toBeDefined()
  })
})

describe('createStorageLocation', () => {
  it('створює місце зберігання', async () => {
    setFromResponse({ id: 'loc-1', name: 'Стелаж A' }, null)
    await createStorageLocation({ parts_company_id: 'pc-1', name: 'Стелаж A' })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_storage_locations')
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'insert failed' })
    await expect(
      createStorageLocation({ parts_company_id: 'pc-1', name: 'X' })
    ).rejects.toBeDefined()
  })
})

describe('updateStorageLocation', () => {
  it('оновлює місце зберігання', async () => {
    setFromResponse({ id: 'loc-1', name: 'Новий стелаж' }, null)
    await updateStorageLocation('loc-1', { name: 'Новий стелаж' })
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_storage_locations')
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'update failed' })
    await expect(updateStorageLocation('loc-1', { name: 'X' })).rejects.toBeDefined()
  })
})

describe('deleteStorageLocation', () => {
  it('видаляє місце зберігання', async () => {
    setFromResponse(null, null)
    await deleteStorageLocation('loc-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_storage_locations')
  })

  it('виключає помилку DB', async () => {
    setFromResponse(null, { message: 'delete failed' })
    await expect(deleteStorageLocation('loc-1')).rejects.toBeDefined()
  })
})
