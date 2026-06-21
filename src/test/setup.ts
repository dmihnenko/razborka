import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'

// Глобальная очистка моков после каждого теста
afterEach(() => {
  vi.clearAllMocks()
})

// Полифилл localStorage (в этой конфигурации jsdom отсутствует)
if (typeof window.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const localStorageMock: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => { store.set(key, String(value)) },
    removeItem: (key) => { store.delete(key) },
    clear: () => { store.clear() },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
  Object.defineProperty(window, 'localStorage', { writable: true, value: localStorageMock })
  Object.defineProperty(globalThis, 'localStorage', { writable: true, value: localStorageMock })
}

// Мок window.matchMedia (не реализовано в jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Мок ResizeObserver (не реализовано в jsdom)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Мок IntersectionObserver (не реализовано в jsdom)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Подавляем console.error для ожидаемых ошибок React в тестах
const originalError = console.error
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') ||
      args[0].includes('React does not recognize') ||
      args[0].includes('Each child in a list'))
  ) {
    return
  }
  originalError(...args)
}
