import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../partage/i18n/i18n'
import type { Routeur } from './routeur'

export function Fournisseurs({ routeur, children }: { routeur: Routeur; children?: ReactNode }) {
  const [clientRequetes] = useState(() => new QueryClient())
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={clientRequetes}>
        <RouterProvider router={routeur} />
        {children}
      </QueryClientProvider>
    </I18nextProvider>
  )
}
