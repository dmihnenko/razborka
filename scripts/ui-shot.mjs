#!/usr/bin/env node
// Визуальная проверка UI: скриншоты страниц на телефоне / планшете / десктопе (2× плотность)
// + ошибки консоли. Используется скилом ui-ux-designer на шаге «визуальный QA».
//
// Примеры:
//   node scripts/ui-shot.mjs https://razborka.net/market
//   node scripts/ui-shot.mjs http://localhost:5173/market/catalog --devices phone,desktop
//   node scripts/ui-shot.mjs ./demo.html --out ./tmp-shots --no-full
//   node scripts/ui-shot.mjs http://localhost:5173/parts/dashboard --auth .auth/ui.json
//
// Страницы кабинета требуют входа. Один раз сохраните сессию (вход вручную, пароли в
// репозиторий не попадают; .auth/ в .gitignore):
//   node scripts/ui-shot.mjs --login http://localhost:5173/login
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DEVICES = {
  phone:   { viewport: { width: 390,  height: 844 },  isMobile: true, hasTouch: true },
  tablet:  { viewport: { width: 768,  height: 1024 }, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 900 } },
}

const args = process.argv.slice(2)
const flag = (name, def) => { const i = args.indexOf(name); return i === -1 ? def : args[i + 1] }
const has = (name) => args.includes(name)
const positional = args.filter((a, i) => !a.startsWith('--') && !['--out', '--devices', '--auth', '--wait'].includes(args[i - 1]))

const toUrl = (t) => /^https?:\/\//.test(t) ? t : pathToFileURL(path.resolve(t)).href
const slug = (u) => u.replace(/^https?:\/\//, '').replace(/^file:\/+/, '').replace(/[^a-z0-9а-я]+/gi, '-').replace(/^-|-$/g, '').slice(-60) || 'page'

async function login(url) {
  const out = flag('--auth', '.auth/ui.json')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const browser = await chromium.launch({ headless: false })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const page = await ctx.newPage()
  await page.goto(url)
  console.log('Войдите в открывшемся окне. Сессия сохранится автоматически после входа (до 5 минут)…')
  await page.waitForURL((u) => !/\/(login|welcome|reset-password)/.test(u.pathname), { timeout: 300_000 })
  await page.waitForTimeout(1500)
  await ctx.storageState({ path: out })
  await browser.close()
  console.log('Сессия сохранена:', out)
}

async function shoot(targets) {
  const out = path.resolve(flag('--out', path.join(os.tmpdir(), 'ui-shots')))
  fs.mkdirSync(out, { recursive: true })
  const devices = flag('--devices', 'phone,desktop').split(',').map((s) => s.trim()).filter(Boolean)
  const auth = flag('--auth', null)
  const wait = Number(flag('--wait', 800))
  const full = !has('--no-full')
  const browser = await chromium.launch()
  let problems = 0
  for (const dev of devices) {
    const spec = DEVICES[dev]
    if (!spec) { console.error('Неизвестное устройство:', dev, '— есть:', Object.keys(DEVICES).join(', ')); continue }
    const ctx = await browser.newContext({ ...spec, deviceScaleFactor: 2, ...(auth ? { storageState: auth } : {}) })
    for (const t of targets) {
      const url = toUrl(t)
      const page = await ctx.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
      page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      } catch (e) {
        errors.push('goto: ' + e.message.split('\n')[0])
      }
      await page.waitForTimeout(wait)
      // горизонтальный скролл страницы — частый признак вылезающего контента
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0)
      const file = path.join(out, `${slug(url)}-${dev}.png`)
      await page.screenshot({ path: file, fullPage: full })
      const notes = []
      if (overflowX > 1) notes.push(`горизонтальный overflow ${overflowX}px`)
      if (errors.length) notes.push(`${errors.length} ошибок консоли`)
      problems += notes.length
      console.log(`${dev.padEnd(7)} ${file}${notes.length ? '  ⚠ ' + notes.join(', ') : ''}`)
      for (const e of errors.slice(0, 5)) console.log('         ' + e)
      await page.close()
    }
    await ctx.close()
  }
  await browser.close()
  console.log(problems ? `\nНайдено проблем: ${problems}` : '\nПроблем не найдено (overflow/консоль). Теперь посмотрите сами скриншоты.')
}

if (has('--login')) {
  await login(positional[0] || 'http://localhost:5173/login')
} else if (!positional.length) {
  console.log('Использование: node scripts/ui-shot.mjs <url|файл> [...] [--devices phone,tablet,desktop] [--out dir] [--auth .auth/ui.json] [--no-full] [--wait ms]\n' +
              '               node scripts/ui-shot.mjs --login [url-входа]')
  process.exit(1)
} else {
  await shoot(positional)
}
