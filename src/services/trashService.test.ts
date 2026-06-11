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
    entity_type: 'parts_inventory',
    entity_id: 'inv-1',
    entity_data: { id: 'inv-1', name: 'Капот' },
    entity_label: 'Запчасть',
    deleted_at: '2024-01-01T00:00:00Z',
    expires_at: '2024-02-01T00:00:00Z',
    parts_company_id: 'parts-1',
    ...override,
  }
}

describe('ENTITY_LABELS', () => {
  it('содержит все типы сущностей', () => {
    expect(ENTITY_LABELS.parts_order).toBe('Заказ разборки')
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
      entityType: 'parts_inventory',
      entityId: 'inv-1',
      entityLabel: 'Капот',
      entityData: { name: 'Капот' },
      partsCompanyId: 'parts-1',
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
        entityType: 'parts_category',
        entityId: 's-1',
        entityLabel: 'Тест',
        entityData: {},
      })
    ).rejects.toBeDefined()
  })
})

describe('getTrashItems', () => {
  const mockItems: TrashItem[] = [makeTrashItem()]

  it('возвращает элементы корзины для partsCompanyId', async () => {
    setFromResponse(mockItems, null)

    const result = await getTrashItems({ partsCompanyId: 'parts-1' })
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
    await expect(getTrashItems({ partsCompanyId: 'parts-1' })).rejects.toBeDefined()
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
