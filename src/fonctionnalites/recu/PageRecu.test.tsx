import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API, ouvrir, sessionAbsente } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import { RECU_EN_LIGNE } from '../encaissement/fixturesRecu'
import type { RecuEnLigne } from '../../partage/api/contrat'

const JETON = RECU_EN_LIGNE.recu.jeton

function recuServi(recu: RecuEnLigne | null) {
  sessionAbsente()
  serveurMsw.use(
    http.get(`${API}/public/recus/${JETON}`, () =>
      recu === null
        ? HttpResponse.json(
            { statut: 404, code: 'RESSOURCE_INTROUVABLE', message: 'Introuvable.', traceId: 't' },
            { status: 404 },
          )
        : HttpResponse.json(recu),
    ),
  )
  ouvrir(`/r/${JETON}`)
}

describe('Reçu en ligne', () => {
  it('montre le reçu au client, sans session, et l’imprime ou l’enregistre en PDF', async () => {
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    recuServi(RECU_EN_LIGNE)

    expect(await screen.findByRole('heading', { level: 1, name: 'Votre reçu' })).toBeVisible()
    expect(screen.getByText('Maquis Chez Tanti', { selector: 'header *' })).toBeVisible()
    const ticket = screen.getByRole('article', { name: 'Reçu BE-000127' })
    expect(ticket).toHaveTextContent(/2× Poulet braisé9\s000/)
    // Les options s'impriment sous l'article, avec leur supplément par unité.
    expect(ticket).toHaveTextContent(/AllocoŒuf\+200/)
    expect(ticket).toHaveTextContent('Flooz (Moov Africa), réf. 7F3K29')
    // Le client est déjà sur son reçu en ligne : le QR code n'y renverrait que lui-même.
    expect(screen.queryByRole('img', { name: 'QR code du reçu en ligne' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Imprimer ou enregistrer en PDF' }))

    await vi.waitFor(() => {
      expect(imprimer).toHaveBeenCalledOnce()
    })
    imprimer.mockRestore()
  })

  it('ajoute les remboursements faits depuis, sans toucher au reçu', async () => {
    recuServi({
      ...RECU_EN_LIGNE,
      remboursements: [{ le: '2026-10-02T09:30:00Z', mode: 'ESPECES', montant: 4500 }],
    })

    const ticket = await screen.findByRole('article', { name: 'Reçu BE-000127' })
    expect(ticket).toHaveTextContent(/TOTAL10\s200\sF/)
    expect(ticket).toHaveTextContent(/Remboursé le 02\/10\/2026 à 09:30, espèces−4\s500/)
  })

  it('dit simplement qu’un lien inconnu ne mène à aucun reçu', async () => {
    recuServi(null)

    expect(await screen.findByRole('heading', { name: 'Reçu introuvable' })).toBeVisible()
    expect(screen.getByText(/Vérifiez que le lien est complet/)).toBeVisible()
  })
})
