import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useRef, type ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { useEtatSession } from '../partage/auth/useSession'
import { i18n } from '../partage/i18n/i18n'
import type { Routeur } from './routeur'

export function Fournisseurs({
  routeur,
  clientRequetes,
  children,
}: {
  routeur: Routeur
  clientRequetes: QueryClient
  children?: ReactNode
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={clientRequetes}>
        <SuiviSession routeur={routeur} clientRequetes={clientRequetes} />
        <RouterProvider router={routeur} />
        {children}
      </QueryClientProvider>
    </I18nextProvider>
  )
}

/**
 * Session perdue en cours d'usage (expirée, révoquée) : on oublie ses données et les gardes
 * ramènent à la connexion.
 */
function SuiviSession({
  routeur,
  clientRequetes,
}: {
  routeur: Routeur
  clientRequetes: QueryClient
}) {
  const { statut } = useEtatSession()
  const precedent = useRef(statut)
  useEffect(() => {
    const etaitConnectee = precedent.current === 'connectee'
    precedent.current = statut
    if (etaitConnectee && statut === 'anonyme') {
      clientRequetes.clear()
      void routeur.invalidate()
    }
  }, [statut, routeur, clientRequetes])
  return null
}
