import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '@/components/ErrorBoundary'

// Компонент, который гарантированно выбрасывает ошибку
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render error')
  }
  return <div>Контент без ошибки</div>
}

describe('ErrorBoundary', () => {
  // Подавляем вывод console.error от React во время теста
  it('отображает children если ошибок нет', () => {
    render(
      <ErrorBoundary>
        <div>Нормальный контент</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Нормальный контент')).toBeInTheDocument()
  })

  it('показывает UI ошибки при падении дочернего компонента', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('отображает кнопку "Попробовать снова"', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Попробовать снова/i)).toBeInTheDocument()
    spy.mockRestore()
  })

  it('отображает кнопку "На главную"', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText(/На главную/i)).toBeInTheDocument()
    spy.mockRestore()
  })

  it('кнопка "Попробовать снова" вызывает сброс и корректно рендерит новый контент', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let throwError = true

    // Компонент, поведение которого контролируется замыканием
    function ToggleThrow() {
      if (throwError) throw new Error('Test render error')
      return <div>Контент без ошибки</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ToggleThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument()

    // Отключаем бросок до того как ErrorBoundary перерисует детей
    throwError = false
    fireEvent.click(screen.getByText(/Попробовать снова/i))

    // Принудительно перерисовываем — ErrorBoundary уже сброшен и дети не бросают
    rerender(
      <ErrorBoundary>
        <ToggleThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Контент без ошибки')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('использует кастомный fallback если передан', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary fallback={<div>Кастомная ошибка</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.queryByText('Что-то пошло не так')).not.toBeInTheDocument()
    expect(screen.getByText('Кастомная ошибка')).toBeInTheDocument()
    spy.mockRestore()
  })
})
