import { describe, it, expect, beforeEach } from 'vitest'
import '../test/mocks/supabase'
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from '@/services/subscriptionService'
import { mockSupabase, setFromResponse } from '../test/mocks/supabase'
import type { Subscription } from '@/types/subscription'

function makePlan(override?: Partial<Subscription>): Subscription {
  return {
    id: 'sub-1',
    name: 'Базовый',
    type: 'monthly',
    price: 999,
    description: null,
    company_type: 'parts',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...override,
  }
}

describe('getSubscriptionPlans', () => {
  it('запрашивает активные планы из таблицы subscriptions', async () => {
    const plans = [makePlan()]
    setFromResponse(plans, null)

    const result = await getSubscriptionPlans()
    expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions')
    expect(Array.isArray(result)).toBe(true)
  })

  it('выбрасывает ошибку при ошибке DB', async () => {
    setFromResponse(null, { message: 'db error' })
    await expect(getSubscriptionPlans()).rejects.toBeDefined()
  })
})

describe('createSubscriptionPlan', () => {
  beforeEach(() => {
    const plan = makePlan()
    setFromResponse(plan, null)
  })

  it('вызывает from("subscriptions").insert', async () => {
    const newPlan = { name: 'Pro', type: 'monthly' as const, price: 1999, description: null, company_type: 'parts' as const, is_active: true }
    await createSubscriptionPlan(newPlan)
    expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions')
  })
})

describe('updateSubscriptionPlan', () => {
  it('обновляет план по id', async () => {
    setFromResponse(makePlan({ name: 'Updated' }), null)

    await updateSubscriptionPlan('sub-1', { name: 'Updated' })
    expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions')
  })
})

describe('deleteSubscriptionPlan', () => {
  it('удаляет план по id', async () => {
    setFromResponse(null, null)
    await deleteSubscriptionPlan('sub-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions')
  })

  it('выбрасывает ошибку при неудаче', async () => {
    setFromResponse(null, { message: 'not found' })
    await expect(deleteSubscriptionPlan('bad-id')).rejects.toBeDefined()
  })
})
