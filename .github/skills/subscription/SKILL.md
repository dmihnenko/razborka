---
name: subscription
description: 'Manage subscription plans and company access in TSP-V2. Use when: working with subscriptions, checking subscription limits, assigning a plan to a company, reading subscription status, managing admin/subscriptions page, subscription-gated features, plan pricing.'
argument-hint: 'Task description, e.g. "check if company has active subscription" or "add new plan"'
---

# Subscription — TSP-V2

Working with the subscription system in TSP-V2 (plans, company subscriptions, access gates).

## When to Use
- Working on `/admin/subscriptions` page
- Adding a feature that requires checking subscription status
- Assigning or updating a company's plan
- Understanding the subscription data model

## Data Model

### Tables
- `subscriptions` — plan definitions (name, price, limits, features)
- `company_subscriptions` — which plan is assigned to which company

### TypeScript Types (`src/types/subscription.ts`)
```ts
Subscription           // a plan definition
CompanySubscription    // assignment of a plan to a company
AssignSubscriptionInput
SubscriptionStats
```

## Service Functions (`src/services/subscriptionService.ts`)

### Plans
```ts
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from '@/services/subscriptionService'

// Get all active plans (ordered by price)
const plans = await getSubscriptionPlans()

// Create a new plan
await createSubscriptionPlan({
  name: 'pro',
  display_name: 'Профессиональный',
  price: 499,
  currency: 'UAH',
  max_users: 10,
  max_vehicles: 500,
  features: ['analytics', 'export', 'api'],
  is_active: true,
})
```

### Company Subscriptions
```ts
import {
  getAllCompanySubscriptions,
  getCompanySubscription,
  assignSubscription,
  updateCompanySubscription,
} from '@/services/subscriptionService'

// Get subscription for a specific company
const sub = await getCompanySubscription(companyId)

// Assign plan to company
await assignSubscription({ company_id: companyId, subscription_id: planId })
```

## Hook Pattern for Subscription Check

```ts
import { useQuery } from '@tanstack/react-query'
import { getCompanySubscription } from '@/services/subscriptionService'
import { useUserProfile } from '@/hooks/useUserProfile'

export function useSubscription() {
  const { data: profile } = useUserProfile()
  const companyId = profile?.sto_company_id ?? profile?.parts_company_id

  return useQuery({
    queryKey: ['subscription', companyId],
    queryFn: () => getCompanySubscription(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,  // plans don't change often
  })
}
```

Note: `src/hooks/useSubscription.ts` already exists in the project.

## Subscription Gate Pattern

Use when a feature should only be accessible on a certain plan:
```tsx
import { useSubscription } from '@/hooks/useSubscription'

function PremiumFeature() {
  const { data: subscription } = useSubscription()
  
  const hasAccess = subscription?.subscription?.features?.includes('analytics')
  
  if (!hasAccess) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Lock className="w-8 h-8 mx-auto mb-2" />
        <p>Эта функция доступна в плане Профессиональный</p>
      </div>
    )
  }
  
  return <AnalyticsContent />
}
```

## Admin Page Routes

| Route | Purpose |
|-------|---------|
| `/admin/subscriptions` | Manage plans and company assignments |
| `/admin/sto` | СТО companies list (assign subscriptions here) |
| `/admin/parts-companies` | Авторазборка companies list |

## Mutation Pattern (Admin)

```ts
const queryClient = useQueryClient()

const assignMutation = useMutation({
  mutationFn: assignSubscription,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['company-subscriptions'] })
    queryClient.invalidateQueries({ queryKey: ['subscription'] })
    toast.success('Подписка назначена')
  },
  onError: () => toast.error('Ошибка назначения подписки'),
})
```

## RLS Note

`subscriptions` table (plans list) is readable by all authenticated users.  
`company_subscriptions` is readable only by admins and the company's own users.  
Check `database/add_subscriptions.sql` for the full policy setup.
