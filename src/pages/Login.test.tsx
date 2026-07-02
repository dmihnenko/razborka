import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../test/mocks/supabase'
import '@/i18n' // инициализируем i18next → t() возвращает русские тексты, а не ключи
import Login from '@/pages/Login'
import { BRAND } from '@/config/brand'
import { mockSupabase } from '../test/mocks/supabase'

// Мок навигации
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Мок sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Login — рендер', () => {
  it('отображает логотип бренда', () => {
    renderLogin()
    // <Logo withText> рендерит вордмарк (BRAND.wordmark.lead)
    expect(screen.getByText(BRAND.wordmark.lead)).toBeInTheDocument()
  })

  it('отображает поле ввода email', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(/email@example.com/i)).toBeInTheDocument()
  })

  it('отображает поле ввода пароля', () => {
    renderLogin()
    // /^пароль$/i — точное совпадение с лейблом, а не с кнопкой «Показать пароль»
    expect(screen.getByLabelText(/^пароль$/i)).toBeInTheDocument()
  })

  it('отображает кнопку "Войти"', () => {
    renderLogin()
    // Точное имя, чтобы не зацепить «Войти через Google»
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })

  it('переключается в режим регистрации', async () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }))
    // AnimatePresence mode="wait" — поля появляются асинхронно
    expect(await screen.findByText('Создать аккаунт')).toBeInTheDocument()
    expect(await screen.findByLabelText(/повторите пароль/i)).toBeInTheDocument()
  })
})

describe('Login — форма входа', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    // По умолчанию возвращаем успешный вход
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@test.com' } },
    })
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (fn: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(fn),
    })
  })

  it('показывает ошибку если вход не удался', async () => {
    const { toast } = await import('sonner')
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    })

    renderLogin()

    fireEvent.change(screen.getByPlaceholderText(/email@example.com/i), {
      target: { value: 'test@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: 'wrongpassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Неверный email или пароль'))
    })
  })
})

describe('Login — валидация регистрации', () => {
  it('показывает ошибку если пароли не совпадают', async () => {
    const { toast } = await import('sonner')
    renderLogin()

    // Переходим в режим регистрации
    fireEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }))

    const confirm = await screen.findByLabelText(/повторите пароль/i)
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'test@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: 'password123' },
    })
    fireEvent.change(confirm, {
      target: { value: 'password456' },
    })

    // Отправляем форму напрямую — обходим HTML5-валидацию jsdom
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Пароли не совпадают')
    })
  })

  it('показывает ошибку при невалидном email', async () => {
    const { toast } = await import('sonner')
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }))

    const confirm = await screen.findByLabelText(/повторите пароль/i)
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'not-an-email' }, // невалидный email
    })
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: 'password123' },
    })
    fireEvent.change(confirm, {
      target: { value: 'password123' },
    })

    // Отправляем форму напрямую — обходим HTML5-валидацию jsdom
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Введите корректный адрес')
      )
    })
  })
})
