import Fuse from 'fuse.js'
import { useMemo } from 'react'

interface FuseSearchOptions {
  keys: string[]
  threshold?: number
  distance?: number
  minMatchCharLength?: number
}

/**
 * Хук для умного поиска с использованием Fuse.js
 * 
 * @param data - Массив данных для поиска
 * @param searchQuery - Поисковый запрос
 * @param options - Опции поиска (ключи для поиска, порог совпадения и т.д.)
 * @returns Отфильтрованный массив данных
 * 
 * @example
 * const filteredCustomers = useFuzzySearch(customers, searchQuery, {
 *   keys: ['name', 'phone', 'email'],
 *   threshold: 0.3
 * })
 */
export function useFuzzySearch<T>(
  data: T[],
  searchQuery: string,
  options: FuseSearchOptions
): T[] {
  return useMemo(() => {
    if (!searchQuery || searchQuery.trim() === '') {
      return data
    }

    const fuse = new Fuse(data, {
      keys: options.keys,
      threshold: options.threshold ?? 0.3,
      distance: options.distance ?? 100,
      minMatchCharLength: options.minMatchCharLength ?? 1,
      includeScore: true,
      useExtendedSearch: false,
    })

    const results = fuse.search(searchQuery)
    return results.map(result => result.item)
  }, [data, searchQuery, options.keys, options.threshold, options.distance, options.minMatchCharLength])
}

/**
 * Функция для выполнения умного поиска
 * 
 * @param data - Массив данных для поиска
 * @param searchQuery - Поисковый запрос
 * @param keys - Ключи объектов, по которым искать
 * @param threshold - Порог совпадения (0.0 = точное совпадение, 1.0 = любое)
 * @returns Отфильтрованный массив данных
 */
export function fuzzySearch<T>(
  data: T[],
  searchQuery: string,
  keys: string[],
  threshold: number = 0.3
): T[] {
  if (!searchQuery || searchQuery.trim() === '') {
    return data
  }

  const fuse = new Fuse(data, {
    keys,
    threshold,
    includeScore: true,
  })

  const results = fuse.search(searchQuery)
  return results.map(result => result.item)
}

/**
 * Создает экземпляр Fuse для повторного использования
 * 
 * @param data - Массив данных
 * @param keys - Ключи для поиска
 * @param threshold - Порог совпадения
 * @returns Экземпляр Fuse
 */
export function createFuzzySearchIndex<T>(
  data: T[],
  keys: string[],
  threshold: number = 0.3
): Fuse<T> {
  return new Fuse(data, {
    keys,
    threshold,
    includeScore: true,
    minMatchCharLength: 2,
  })
}
