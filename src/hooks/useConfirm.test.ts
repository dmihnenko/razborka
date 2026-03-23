import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConfirm } from '@/hooks/useConfirm'

describe('useConfirm', () => {
  it('диалог изначально закрыт', () => {
    const { result } = renderHook(() => useConfirm())
    expect(result.current.dialogProps.isOpen).toBe(false)
  })

  it('confirm() открывает диалог', async () => {
    const { result } = renderHook(() => useConfirm())

    act(() => {
      result.current.confirm({ message: 'Тестовое сообщение?' })
    })

    expect(result.current.dialogProps.isOpen).toBe(true)
    expect(result.current.dialogProps.message).toBe('Тестовое сообщение?')
  })

  it('confirm() передаёт title, confirmText, cancelText, danger', async () => {
    const { result } = renderHook(() => useConfirm())

    act(() => {
      result.current.confirm({
        title: 'Заголовок',
        message: 'Уверены?',
        confirmText: 'Да',
        cancelText: 'Нет',
        danger: true,
      })
    })

    const props = result.current.dialogProps
    expect(props.title).toBe('Заголовок')
    expect(props.message).toBe('Уверены?')
    expect(props.confirmText).toBe('Да')
    expect(props.cancelText).toBe('Нет')
    expect(props.danger).toBe(true)
  })

  it('onConfirm() разрешает промис с true и закрывает диалог', async () => {
    const { result } = renderHook(() => useConfirm())

    let resolvedValue: boolean | undefined

    act(() => {
      result.current.confirm({ message: 'Confirm?' }).then((v) => {
        resolvedValue = v
      })
    })

    expect(result.current.dialogProps.isOpen).toBe(true)

    act(() => {
      result.current.dialogProps.onConfirm()
    })

    // Ждём разрешения промиса
    await act(async () => {})

    expect(resolvedValue).toBe(true)
    expect(result.current.dialogProps.isOpen).toBe(false)
  })

  it('onCancel() разрешает промис с false и закрывает диалог', async () => {
    const { result } = renderHook(() => useConfirm())

    let resolvedValue: boolean | undefined

    act(() => {
      result.current.confirm({ message: 'Cancel?' }).then((v) => {
        resolvedValue = v
      })
    })

    act(() => {
      result.current.dialogProps.onCancel()
    })

    await act(async () => {})

    expect(resolvedValue).toBe(false)
    expect(result.current.dialogProps.isOpen).toBe(false)
  })

  it('диалог можно открыть повторно после закрытия', async () => {
    const { result } = renderHook(() => useConfirm())

    act(() => {
      result.current.confirm({ message: 'First?' })
    })

    act(() => {
      result.current.dialogProps.onCancel()
    })

    await act(async () => {})
    expect(result.current.dialogProps.isOpen).toBe(false)

    act(() => {
      result.current.confirm({ message: 'Second?' })
    })

    expect(result.current.dialogProps.isOpen).toBe(true)
    expect(result.current.dialogProps.message).toBe('Second?')
  })
})
