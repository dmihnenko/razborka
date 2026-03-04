import { useState, useCallback } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean
  resolve: ((value: boolean) => void) | null
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, isOpen: true, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState((s) => ({ ...s, isOpen: false, resolve: null }))
  }, [state])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState((s) => ({ ...s, isOpen: false, resolve: null }))
  }, [state])

  return {
    confirm,
    dialogProps: {
      isOpen: state.isOpen,
      title: state.title,
      message: state.message,
      confirmText: state.confirmText,
      cancelText: state.cancelText,
      danger: state.danger,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  }
}
