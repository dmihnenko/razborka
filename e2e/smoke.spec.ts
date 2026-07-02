import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────
// Public routes — no auth required
// ─────────────────────────────────────────────────────────────────

test('Login page loads with form', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/Razborka/i)
  await expect(page.getByRole('button', { name: /войти/i })).toBeVisible()
})

test('Vehicle access page loads', async ({ page }) => {
  const response = await page.goto('/vehicle-access')
  expect(response?.status()).toBe(200)
  await expect(page.getByText(/код/i).first()).toBeVisible()
})

test('Public market home loads', async ({ page }) => {
  const response = await page.goto('/market')
  expect(response?.status()).toBe(200)
})

test('Business landing loads', async ({ page }) => {
  const response = await page.goto('/business')
  expect(response?.status()).toBe(200)
})

// ─────────────────────────────────────────────────────────────────
// SPA routing — valid deep routes must return index.html (not a 404 error page)
// СТО-маршруты (/customers,/vehicles,/appointments,/work-orders,/analytics) удалены
// вместе с подсистемой — их здесь быть не должно.
// ─────────────────────────────────────────────────────────────────

const spaRoutes = [
  '/',
  '/parts/dashboard',
  '/parts/inventory',
  '/parts/orders',
  '/parts/customers',
  '/admin',
]

for (const route of spaRoutes) {
  test(`SPA route "${route}" serves app (200, no server 404)`, async ({ page }) => {
    const response = await page.goto(route)
    // SPA всегда отдаёт index.html со статусом 200 (роутинг на клиенте).
    expect(response?.status()).toBe(200)
  })
}

// Неизвестный путь — светлая 404-страница приложения (клиентская, статус 200).
test('Unknown route renders in-app 404 page', async ({ page }) => {
  await page.goto('/definitely-not-a-real-route-xyz')
  await expect(page.getByText(/404/).first()).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────
// PWA assets
// ─────────────────────────────────────────────────────────────────

test('PWA manifest is served', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.name).toBeDefined()
  expect(body.short_name).toBeDefined()
})

test('Service worker is served', async ({ request }) => {
  const response = await request.get('/sw.js')
  expect(response.status()).toBe(200)
})

// ─────────────────────────────────────────────────────────────────
// Protected routes redirect to /login
// ─────────────────────────────────────────────────────────────────

test('Dashboard redirects to /login when not authenticated', async ({ page }) => {
  await page.goto('/parts/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('Admin redirects to /login when not authenticated', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})
