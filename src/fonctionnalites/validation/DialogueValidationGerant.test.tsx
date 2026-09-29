import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import { creerClientRequetes } from '../../app/clientRequetes'
import type { ProfilCaisse } from '../../partage/api/contrat'
import { definirJetonCaisse } from '../../partage/api/jetonCaisse'
import { DialogueValidationGerant } from './DialogueValidationGerant'

const LIGNE = '3c1d0000-0000-4000-8000-000000000001'
const AFI: ProfilCaisse = {
  utilisateurId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0301',
  prenom: 'Afi',
  nomCourt: 'Afi M.',
  role: 'GERANT',
  bloque: false,
  pinAChanger: false,
}
const TANTI: ProfilCaisse = {
  utilisateurId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0302',
  prenom: 'Tanti',
  nomCourt: 'Tanti A.',
  role: 'PROPRIETAIRE',
  bloque: false,
  pinAChanger: false,
}

function gerants(validateurs: ProfilCaisse[], reponse: () => Response) {
  const envois: { permission: string | null; corps?: unknown }[] = []
  serveurMsw.use(
    http.get(`${API}/caisse/validateurs`, ({ request }) => {
      envois.push({ permission: new URL(request.url).searchParams.get('permission') })
      return HttpResponse.json(validateurs)
    }),
    http.post(`${API}/caisse/validations`, async ({ request }) => {
      envois.push({ permission: null, corps: await request.json() })
      return reponse()
    }),
  )
  return envois
}

function afficher() {
  definirJetonCaisse('eyJ.caisse')
  const surValide = vi.fn()
  const surAnnuler = vi.fn()
  render(
    <QueryClientProvider client={creerClientRequetes({ nouvelEssai: false })}>
      <DialogueValidationGerant
        titre="Annuler 1 Attiéké poisson ?"
        contexte="T4, Terrasse. Ligne déjà envoyée en cuisine, demandée par Kossi A."
        permission="LIGNE_ANNULER_APRES_ENVOI"
        objetId={LIGNE}
        libelleAnnuler="Ne pas annuler"
        surValide={surValide}
        surAnnuler={surAnnuler}
      />
    </QueryClientProvider>,
  )
  return { surValide, surAnnuler }
}

async function taper(code: string) {
  for (const chiffre of code) {
    await userEvent.click(screen.getByRole('button', { name: chiffre }))
  }
}

describe('DialogueValidationGerant', () => {
  it('fait valider l’action par le PIN d’un gérant choisi, pour cet objet', async () => {
    const envois = gerants([AFI, TANTI], () =>
      HttpResponse.json(
        { id: 'a1b20000-0000-4000-8000-000000000001', expireLe: '2026-09-29T20:42:00Z' },
        { status: 201 },
      ),
    )
    const { surValide } = afficher()

    const dialogue = screen.getByRole('dialog', { name: 'Annuler 1 Attiéké poisson ?' })
    expect(dialogue).toHaveTextContent('Validation d’un gérant')
    expect(dialogue).toHaveTextContent('pendant 60 secondes')
    await userEvent.click(await within(dialogue).findByRole('button', { name: /Afi M\./ }))
    expect(within(dialogue).getByText('Code de Afi M.')).toBeVisible()
    await taper('5937')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Valider' }))

    await vi.waitFor(() => {
      expect(surValide).toHaveBeenCalledWith({
        id: 'a1b20000-0000-4000-8000-000000000001',
        expireLe: '2026-09-29T20:42:00Z',
      })
    })
    expect(envois).toEqual([
      { permission: 'LIGNE_ANNULER_APRES_ENVOI' },
      {
        permission: null,
        corps: {
          permission: 'LIGNE_ANNULER_APRES_ENVOI',
          objetId: LIGNE,
          validateurId: AFI.utilisateurId,
          pin: '5937',
        },
      },
    ])
  })

  it('refuse un code erroné et vide la saisie', async () => {
    gerants([AFI], () =>
      HttpResponse.json(
        { statut: 401, code: 'PIN_INCORRECT', message: 'x', traceId: 't' },
        { status: 401 },
      ),
    )
    const { surValide } = afficher()

    await userEvent.click(await screen.findByRole('button', { name: /Afi M\./ }))
    await taper('1111')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Code incorrect.')
    expect(screen.getByRole('status', { name: '0 chiffre saisi' })).toBeInTheDocument()
    expect(surValide).not.toHaveBeenCalled()
  })

  it('renonce à l’action avec le bouton d’annulation ou Échap', async () => {
    gerants([AFI], () => HttpResponse.json({}))
    const { surAnnuler } = afficher()

    expect(await screen.findByRole('button', { name: 'Ne pas annuler' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Ne pas annuler' }))

    expect(surAnnuler).toHaveBeenCalledTimes(2)
  })

  it('dit quand personne ne peut valider ici', async () => {
    gerants([], () => HttpResponse.json({}))
    afficher()

    expect(
      await screen.findByText(/Personne dans cet établissement ne peut valider cette action/),
    ).toBeVisible()
  })
})
