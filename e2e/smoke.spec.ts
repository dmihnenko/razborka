import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────
// Public routes — no auth required
// ─────────────────────────────────────────────────────────────────

test('Login page loads with form', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/CRM/)
  await expect(page.getByText(/Email или Username/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /войти/i })).toBeVisible()
})

test('Vehicle access page loads', async ({ page }) => {
  await page.goto('/vehicle-access')
  await expect(page.getByText(/доступ к автомобилю/i)).toBeVisible()
  await expect(page.getByText(/4-значный код/i)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────
// SPA routing — all deep routes must return index.html (not 404)
// ─────────────────────────────────────────────────────────────────

const protectedRoutes = [
  '/',
  '/customers',
  '/vehicles',
  '/appointments',
  '/work-orders',
  '/parts',
  '/parts/vehicles',
  '/parts/inventory',
  '/parts/orders',
  '/parts/customers',
  '/admin',
  '/analytics',
]

for (const route of protectedRoutes) {
  test(`SPA route "${route}" does not 404`, async ({ page }) => {
    const response = await page.goto(route)
    // SPA must return 200 (index.html) — never a 404 page
    expect(response?.status()).toBe(200)
    // Protected routes redirect to login — check there's no 404 text
    await expect(page.getByText(/404|page not found|cannot get/i)).not.toBeVisible()
  })
}

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
// Login form — validation
// ─────────────────────────────────────────────────────────────────

test('Login form shows error on empty submit', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /войти/i }).click()
  // HTML5 required validation or toast error should appear
  const hasValidation =
    (await page.getByText(/обязательн|required|заполните|введите/i).count()) > 0 ||
    (await page.locator('input:invalid').count()) > 0
  expect(hasValidation).toBeTruthy()
})

test('Login with wrong credentials shows error toast', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/Email или Username/i).fill('wrong@test.com')
  await page.getByLabel(/Пароль/i).fill('wrongpassword123')
  await page.getByRole('button', { name: /войти/i }).click()
  // Wait for toast error
  await expect(page.getByText(/неверн|invalid|ошибк|error/i)).toBeVisible({ timeout: 8000 })
})

// ─────────────────────────────────────────────────────────────────
// Protected routes redirect to /login
// ─────────────────────────────────────────────────────────────────

test('Dashboard redirects to /login when not authenticated', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('Parts section redirects to /login when not authenticated', async ({ page }) => {
  await page.goto('/parts')
  await expect(page).toHaveURL(/\/login/)
})
