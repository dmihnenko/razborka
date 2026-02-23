const STORAGE_KEY = 'parts_imgbb_api_key'

export function getImgbbKey(): string {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function setImgbbKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}
