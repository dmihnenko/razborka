const IBB = 'https://i.ibb.co/'

/** i.ibb.co/<путь> -> /img/ibb/<путь> (прокси Worker, отсекает 503-заглушки imgbb). */
export function photoSrc(url: string): string
export function photoSrc(url: string | null | undefined): string | null | undefined
export function photoSrc(url: string | null | undefined): string | null | undefined {
  if (!url || import.meta.env.DEV) return url
  return url.startsWith(IBB) ? '/img/ibb/' + url.slice(IBB.length) : url
}
