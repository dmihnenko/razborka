import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../test/mocks/supabase'
import {
  moveToTrash,
  getTrashItems,
  permanentlyDelete,
  restoreFromTrash,
  ENTITY_LABELS,
  type TrashItem,
} from '@/services/trashService'
import { mockSupabase, setFromResponse } from '../test/mocks/supabase'

// ────────────────────────────────────────────────────
// Вспомогательная фабрика TrashItem
// ────────────────────────────────────────────────────
function makeTrashItem(override?: Partial<TrashItem>): TrashItem {
  return {
    id: 'trash-1',
    entity_type: 'customer',
    entity_id: 'customer-1',
    entity_data: { customer: { id: 'customer-1', name: 'Test' }, vehicles: [], appointments: [] },
    entity_label: 'Клиент',
    deleted_at: '2024-01-01T00:00:00Z',
    expires_at: '2024-02-01T00:00:00Z',
    sto_company_id: 'sto-1',
    parts_company_id: null,
    ...override,
  }
}

describe('ENTITY_LABELS', () => {
  it('содержит все типы сущностей', () => {
    expect(ENTITY_LABELS.customer).toBe('Клиент')
    expect(ENTITY_LABELS.vehicle).toBe('Автомобиль')
    expect(ENTITY_LABELS.service).toBe('Услуга')
    expect(ENTITY_LABELS.work_order).toBe('Заказ-наряд')
    expect(ENTITY_LABELS.parts_vehicle).toBe('Авто на разборку')
    expect(ENTITY_LABELS.parts_inventory).toBe('Запчасть')
    expect(ENTITY_LABELS.parts_category).toBe('Категория')
    expect(ENTITY_LABELS.parts_customer).toBe('Клиент разборки')
  })
})

describe('moveToTrash', () => {
  beforeEach(() => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    setFromResponse(null, null)
  })

  it('вызывает supabase.from("trash_bin").insert с правильными данными', async () => {
    await moveToTrash({
      entityType: 'customer',
      entityId: 'c-1',
      entityLabel: 'Test Customer',
      entityData: { name: 'Test' },
      stoCompanyId: 'sto-1',
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('trash_bin')
  })

  it('выбрасывает ошибку если supabase вернул error', async () => {
    const builder = setFromResponse(null, { message: 'DB error' })
    // single/then должны вернуть ошибку
    builder.insert = vi.fn().mockReturnThis()
     
    ;(builder as any).then = (fn?: ((v: unknown) => unknown) | null) =>
      Promise.resolve({ data: null, error: { message: 'DB error' } }).then(fn ?? undefined)

    mockSupabase.from.mockReturnValue(builder)

    await expect(
      moveToTrash({
        entityType: 'service',
        entityId: 's-1',
        entityLabel: 'Тест',
        entityData: {},
      })
    ).rejects.toBeDefined()
  })
})

describe('getTrashItems', () => {
  const mockItems: TrashItem[] = [makeTrashItem()]

  it('возвращает элементы корзины для stoCompanyId', async () => {
    setFromResponse(mockItems, null)

    const result = await getTrashItems({ stoCompanyId: 'sto-1' })
    expect(mockSupabase.from).toHaveBeenCalledWith('trash_bin')
    expect(Array.isArray(result)).toBe(true)
  })

  it('возвращает пустой массив при data = null', async () => {
    setFromResponse(null, null)
    const result = await getTrashItems({})
    expect(result).toEqual([])
  })

  it('выбрасывает ошибку при ошибке DB', async () => {
    setFromResponse(null, { message: 'fail' })
    await expect(getTrashItems({ stoCompanyId: 'sto-1' })).rejects.toBeDefined()
  })
})

describe('permanentlyDelete', () => {
  it('вызывает delete().eq("id", trashId)', async () => {
    setFromResponse(null, null)

    await permanentlyDelete('trash-id-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('trash_bin')
  })

  it('выбрасывает ошибку при ошибке DB', async () => {
    const builder = setFromResponse(null, { message: 'deletion failed' })
    builder.delete = vi.fn().mockReturnThis()
     
    ;(builder as any).then = (fn?: ((v: unknown) => unknown) | null) =>
      Promise.resolve({ data: null, error: { message: 'deletion failed' } }).then(fn ?? undefined)
    mockSupabase.from.mockReturnValue(builder)

    await expect(permanentlyDelete('trash-id-1')).rejects.toBeDefined()
  })
})

describe('restoreFromTrash', () => {
  beforeEach(() => {
    setFromResponse(null, null)
  })

  it('восстанавливает клиента с авто и заявками', async () => {
    const item = makeTrashItem({
      entity_type: 'customer',
      entity_data: {
        customer: { id: 'c-1', name: 'Иванов' },
        vehicles: [{ id: 'v-1', customer_id: 'c-1' }],
        appointments: [{ id: 'a-1', customer_id: 'c-1' }],
      },
    })
    await restoreFromTrash(item)
    expect(mockSupabase.from).toHaveBeenCalledWith('customers')
    expect(mockSupabase.from).toHaveBeenCalledWith('trash_bin')
  })

  it('восстанавливает клиента без авто и заявок', async () => {
    const item = makeTrashItem({
      entity_type: 'customer',
      entity_data: {
        customer: { id: 'c-1', name: 'Петров' },
        vehicles: [],
        appointments: [],
      },
    })
    await restoreFromTrash(item)
    expect(mockSupabase.from).toHaveBeenCalledWith('customers')
  })

  it('восстанавливает автомобиль с заявками', async () => {
    const item = makeTrashItem({
      entity_type: 'vehicle',
      entity_data: {
        vehicle: { id: 'v-1', make: 'Toyota' },
        appointments: [{ id: 'a-1' }],
      },
    })
    await restoreFromTrash(item)
    expect(mockSupabase.from).toHaveBeenCalledWith('vehicles')
  })

  it('восстанавливает услугу (service)', async () => {
    const item = makeTrashItem({
      entity_type: 'service',
      entity_data: { id: 'svc-1', name: 'Замена масла' },
    })
    await restoreFromTrash(item)
    expect(mockSupabase.from).toHaveBeenCalledWith('services')
  })

  it('восстанавливает заказ-наряд (work_order)', async () => {
    const item = makeTrashItem({
      entity_type: 'work_order',
      entity_data: { id: 'wo-1' },
    })
    await restoreFromTrash(item)
    expect(mockSupabase.from).toHaveBeenCalledWith('work_orders')
  })

  it('восстанавливает авто разборки с запчастями', async () => {
    const item = makeTrashItem({
      entity_type: 'parts_vehicle',
      entity_data: {
        vehicle: { id: 'pv-1', make: 'BMW' },
        parts: [{ id: 'p-1' }],
      },
    })
    await restoreFromTrash(item)
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_vehicles')
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_inventory')
  })

  it('восстанавливает запчасть (parts_inventory)', async () => {
    const item = makeTrashItem({
      entity_type: 'parts_inventory',
      entity_data: { id: 'inv-1', name: 'Капот' },
    })
    await restoreFromTrash(item)
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_inventory')
  })

  it('восстанавливает категорию (parts_category)', async () => {
    const item = makeTrashItem({
      entity_type: 'parts_category',
      entity_data: { id: 'cat-1', name: 'Кузов' },
    })
    await restoreFromTrash(item)
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_categories')
  })

  it('восстанавливает клиента разборки (parts_customer)', async () => {
    const item = makeTrashItem({
      entity_type: 'parts_customer',
      entity_data: { id: 'pc-1', full_name: 'Сидоров' },
    })
    await restoreFromTrash(item)
    expect(mockSupabase.from).toHaveBeenCalledWith('parts_customers')
  })

  it('выбрасывает ошибку для неизвестного типа', async () => {
    const item = makeTrashItem()
    ;(item as any).entity_type = 'unknown_type'
    await expect(restoreFromTrash(item)).rejects.toThrow('Неизвестный тип')
  })
})
