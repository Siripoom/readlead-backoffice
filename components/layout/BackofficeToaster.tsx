'use client'
import {
  ToastCloseTrigger,
  ToastDescription,
  ToastIndicator,
  ToastRoot,
  ToastTitle,
  Toaster,
} from '@chakra-ui/react'
import { toaster } from '@/lib/toaster'

export function BackofficeToaster() {
  return (
    <Toaster toaster={toaster}>
      {(toast) => (
        <ToastRoot key={toast.id}>
          <ToastIndicator />
          <ToastTitle>{toast.title as string}</ToastTitle>
          {toast.description && (
            <ToastDescription>{toast.description as string}</ToastDescription>
          )}
          <ToastCloseTrigger />
        </ToastRoot>
      )}
    </Toaster>
  )
}
