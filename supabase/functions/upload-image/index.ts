import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Серверный прокси загрузки изображений на ImgBB.
// Ключ ImgBB хранится ТОЛЬКО на сервере (Deno.env IMGBB_API_KEY) и не попадает в клиентский
// бандл. Доступ — только аутентифицированным (gateway verify_jwt=true: клиент шлёт apikey +
// Authorization через supabase.functions.invoke). Аноним нашим ключом залить не может.

const ALLOWED_ORIGINS = [
  'https://razborka.net',
  'https://www.razborka.net',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  if (req.method !== 'POST') {
    return json(req, 405, { error: 'Method not allowed' })
  }

  const apiKey = Deno.env.get('IMGBB_API_KEY')
  if (!apiKey) {
    return json(req, 500, { error: 'IMGBB_API_KEY not configured' })
  }

  try {
    const inForm = await req.formData()
    const image = inForm.get('image')
    if (!image || !(image instanceof File)) {
      return json(req, 400, { error: 'No image provided' })
    }
    // Лимит размера на сервере (защита от злоупотребления)
    if (image.size > 12 * 1024 * 1024) {
      return json(req, 413, { error: 'Image too large' })
    }

    const out = new FormData()
    out.append('key', apiKey)
    out.append('image', image, (image as File).name || 'upload.jpg')

    const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: out })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.success) {
      return json(req, 502, { error: data?.error?.message || 'ImgBB upload failed' })
    }

    return json(req, 200, {
      url: data.data.url,
      medium_url: data.data.medium?.url || data.data.display_url || undefined,
      thumb_url: data.data.thumb?.url || data.data.url,
      delete_url: data.data.delete_url,
    })
  } catch (e: any) {
    return json(req, 500, { error: e?.message || 'Internal server error' })
  }
})
