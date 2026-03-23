import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../test/mocks/supabase'
import Login from '@/pages/Login'
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
  it('отображает заголовок "CRM"', () => {
    renderLogin()
    expect(screen.getByText('CRM')).toBeInTheDocument()
  })

  it('отображает поле ввода "Email или Username"', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(/email@example.com или username/i)).toBeInTheDocument()
  })

  it('отображает поле ввода пароля', () => {
    renderLogin()
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument()
  })

  it('отображает кнопку "Войти"', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument()
  })

  it('переключается в режим регистрации', () => {
    renderLogin()
    const toggleBtn = screen.getByRole('button', { name: /зарегистрироваться/i })
    fireEvent.click(toggleBtn)
    expect(screen.getByText('Регистрация')).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
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

    fireEvent.change(screen.getByPlaceholderText(/email@example.com или username/i), {
      target: { value: 'test@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/пароль/i), {
      target: { value: 'wrongpassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Ошибка входа'))
    })
  })
})

describe('Login — валидация регистрации', () => {
  it('показывает ошибку если пароли не совпадают', async () => {
    const { toast } = await import('sonner')
    renderLogin()

    // Переходим в режим регистрации
    fireEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }))

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'testuser' },
    })
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
      target: { value: 'password456' },
    })

    // Отправляем форму напрямую — обходим HTML5-валидацию jsdom
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Пароли не совпадают')
    })
  })

  it('показывает ошибку при невалидном username', async () => {
    const { toast } = await import('sonner')
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }))

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'ab' }, // слишком короткий (< 3 символов)
    })
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
      target: { value: 'password123' },
    })

    // Отправляем форму напрямую — обходим HTML5-валидацию jsdom
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Username должен содержать')
      )
    })
  })
})
