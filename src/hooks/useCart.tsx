import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CartItem } from '@/types/marketplace'

// ============================================================================
// Корзина маркетплейса — хранится в localStorage (анонимный покупатель)
// ============================================================================

const STORAGE_KEY = 'tsp_market_cart'

export interface CartGroup {
  companyId: string
  companyName: string
  items: CartItem[]
}

export interface CartContextValue {
  items: CartItem[]
  /** Добавить позицию; если уже в корзине — увеличивает количество */
  addItem: (item: CartItem) => void
  removeItem: (inventoryId: string) => void
  /** Установить количество; qty <= 0 удаляет позицию */
  setQty: (inventoryId: string, qty: number) => void
  clear: () => void
  /** Сумма quantity по всем позициям (для бейджа) */
  totalCount: number
  /** Позиции, сгруппированные по разборке (для отправки заявок) */
  groupedByCompany: () => CartGroup[]
}

const CartContext = createContext<CartContextValue | null>(null)

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as CartItem[]).filter(
      (i) => i && typeof i.inventoryId === 'string' && typeof i.companyId === 'string'
    )
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart)

  // Персист в localStorage при каждом изменении
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* квота/приватный режим — корзина живёт в памяти */
    }
  }, [items])

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.inventoryId === item.inventoryId)
      // Кап по остатку: maxQty из новой позиции или из уже лежащей
      const cap = item.maxQty ?? existing?.maxQty ?? Infinity
      if (existing) {
        return prev.map(i =>
          i.inventoryId === item.inventoryId
            ? { ...i, maxQty: item.maxQty ?? i.maxQty, quantity: Math.min(i.quantity + (item.quantity || 1), cap) }
            : i
        )
      }
      return [...prev, { ...item, quantity: Math.min(item.quantity || 1, cap) }]
    })
  }, [])

  const removeItem = useCallback((inventoryId: string) => {
    setItems(prev => prev.filter(i => i.inventoryId !== inventoryId))
  }, [])

  const setQty = useCallback((inventoryId: string, qty: number) => {
    setItems(prev =>
      qty <= 0
        ? prev.filter(i => i.inventoryId !== inventoryId)
        : prev.map(i => (i.inventoryId === inventoryId
            ? { ...i, quantity: Math.min(qty, i.maxQty ?? Infinity) }  // кап по остатку
            : i))
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const totalCount = useMemo(
    () => items.reduce((sum, i) => sum + (i.quantity || 1), 0),
    [items]
  )

  const groupedByCompany = useCallback((): CartGroup[] => {
    const map = new Map<string, CartGroup>()
    for (const item of items) {
      const group = map.get(item.companyId)
      if (group) group.items.push(item)
      else map.set(item.companyId, {
        companyId: item.companyId,
        companyName: item.companyName,
        items: [item],
      })
    }
    return [...map.values()]
  }, [items])

  const value = useMemo<CartContextValue>(
    () => ({ items, addItem, removeItem, setQty, clear, totalCount, groupedByCompany }),
    [items, addItem, removeItem, setQty, clear, totalCount, groupedByCompany]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart() должен вызываться внутри <CartProvider> (его оборачивает MarketLayout)')
  }
  return ctx
}
