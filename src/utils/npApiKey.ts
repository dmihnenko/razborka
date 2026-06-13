const STORAGE_KEY = 'tsp_np_api_key'

export function getNpApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function setNpApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}
