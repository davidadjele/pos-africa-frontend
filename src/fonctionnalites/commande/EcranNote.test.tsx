import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import {
  FLAG,
  FLAG_ENVOYE,
  NOTE_T4,
  NOTE_VIDE,
  PLAN,
  POULET,
  POULET_A_ENVOYER,
} from '../../../tests/commandes'
import { serveurMsw } from '../../../tests/serveurMsw'
import type {
  CommandeDetail,
  DemandeAjout,
  DemandeLigne,
  LigneCarteEtablissement,
} from '../../partage/api/contrat'

function noteServie(
  note: CommandeDetail = NOTE_T4,
  carte: LigneCarteEtablissement[] = [FLAG, POULET],
) {
  serveurMsw.use(
    http.get(`${API}/caisse/commandes/${note.id}`, () => HttpResponse.json(note)),
    http.get(`${API}/caisse/carte`, () => HttpResponse.json(carte)),
    http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)),
  )
  return caisseOuverte(`/caisse/notes/${note.id}`)
}

async function noteEnCours() {
  return screen.findByRole('region', { name: 'Note en cours' })
}

describe('EcranNote', () => {
  it('présente la note : table, lignes envoyées ou à envoyer, taxes et total', async () => {
    noteServie()

    const note = await noteEnCours()
    expect(within(note).getByRole('heading', { name: /T4/ })).toHaveTextContent('Terrasse')
    expect(note).toHaveTextContent('n°42, 3 couverts, ouverte à 18:55 par Kossi A.')
    const lignes = within(note).getByRole('list', { name: 'Articles de la note' })
    expect(lignes).toHaveTextContent('1×Flag 65 clEnvoyé à 19:021 200')
    expect(lignes).toHaveTextContent('2×Poulet braiséÀ envoyer9 000')
    expect(within(lignes).getAllByRole('button', { name: /Un de plus/ })).toHaveLength(1)
    expect(note).toHaveTextContent('3 articles')
    expect(note).toHaveTextContent('dont TVA 18 % 1 556 F')
    expect(note).toHaveTextContent('10 200 FCFA')
    expect(within(note).getByRole('button', { name: /Encaisser/ })).toBeDisabled()
  })

  it('ajoute un produit touché sur la carte', async () => {
    const recus: DemandeAjout[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/lignes`, async ({ request }) => {
        recus.push((await request.json()) as DemandeAjout)
        return HttpResponse.json({ ...NOTE_T4, total: 11400, articles: 4, version: 4 })
      }),
    )
    noteServie()

    const produits = await screen.findByRole('list', { name: 'Produits' })
    await userEvent.click(within(produits).getByRole('button', { name: /Flag 65 cl/ }))

    expect(await noteEnCours()).toHaveTextContent('11 400 FCFA')
    expect(recus).toEqual([{ produitId: FLAG.produitId }])
  })

  it('retire une unité d’une ligne pas encore envoyée', async () => {
    const recues: DemandeLigne[] = []
    serveurMsw.use(
      http.put(
        `${API}/caisse/commandes/${NOTE_T4.id}/lignes/${POULET_A_ENVOYER.id}`,
        async ({ request }) => {
          recues.push((await request.json()) as DemandeLigne)
          return HttpResponse.json({ ...NOTE_T4, version: 4 })
        },
      ),
    )
    noteServie()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Un de moins : Poulet braisé' }),
    )

    await screen.findByRole('region', { name: 'Note en cours' })
    expect(recues).toEqual([{ quantite: 1 }])
  })

  it('ajoute une consigne de préparation à une ligne', async () => {
    const recues: DemandeLigne[] = []
    serveurMsw.use(
      http.put(
        `${API}/caisse/commandes/${NOTE_T4.id}/lignes/${POULET_A_ENVOYER.id}`,
        async ({ request }) => {
          recues.push((await request.json()) as DemandeLigne)
          return HttpResponse.json({
            ...NOTE_T4,
            lignes: [FLAG_ENVOYE, { ...POULET_A_ENVOYER, note: 'sans piment' }],
            version: 4,
          })
        },
      ),
    )
    noteServie()

    await userEvent.click(await screen.findByRole('button', { name: 'Modifier Poulet braisé' }))
    const dialogue = screen.getByRole('dialog', { name: 'Poulet braisé' })
    await userEvent.type(
      within(dialogue).getByRole('textbox', { name: 'Note pour la préparation' }),
      'sans piment',
    )
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('« sans piment »')).toBeVisible()
    expect(recues).toEqual([{ quantite: 2, note: 'sans piment' }])
  })

  it('dit qui vient de déclarer épuisé un produit refusé', async () => {
    let carte = [FLAG, POULET]
    serveurMsw.use(
      http.get(`${API}/caisse/carte`, () => HttpResponse.json(carte)),
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/lignes`, () => {
        carte = [
          FLAG,
          { ...POULET, epuise: true, epuisePar: 'Afi M.', epuiseLe: '2026-09-29T20:05:00Z' },
        ]
        return HttpResponse.json(
          { statut: 409, code: 'PRODUIT_EPUISE', message: 'x' },
          { status: 409 },
        )
      }),
    )
    serveurMsw.use(
      http.get(`${API}/caisse/commandes/${NOTE_T4.id}`, () => HttpResponse.json(NOTE_T4)),
      http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)),
    )
    caisseOuverte(`/caisse/notes/${NOTE_T4.id}`)

    const produits = await screen.findByRole('list', { name: 'Produits' })
    await userEvent.click(within(produits).getByRole('button', { name: /Poulet braisé/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Poulet braisé vient d’être déclaré épuisé (Afi M., 20:05). Il n’a pas été ajouté.',
    )
    expect(await within(produits).findByText('Épuisé ce jour')).toBeVisible()
  })

  it('ferme une note restée vide en revenant au plan', async () => {
    let fermee = false
    serveurMsw.use(
      http.delete(`${API}/caisse/commandes/${NOTE_VIDE.id}`, () => {
        fermee = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    noteServie(NOTE_VIDE)

    const note = await noteEnCours()
    expect(within(note).getByRole('heading', { name: /n°44/ })).toHaveTextContent('Comptoir')
    expect(note).toHaveTextContent('Note vide')
    await userEvent.click(within(note).getByRole('button', { name: /Plan de salle/ }))

    expect(await screen.findByRole('list', { name: 'Tables' })).toBeVisible()
    expect(fermee).toBe(true)
  })

  it('filtre la carte par catégorie et par nom', async () => {
    noteServie()

    const produits = await screen.findByRole('list', { name: 'Produits' })
    const rail = screen.getByRole('navigation', { name: 'Catégories' })
    expect(
      within(rail)
        .getAllByRole('button')
        .map((bouton) => bouton.textContent),
    ).toEqual(['Tout2', 'Bières1', 'Grillades1'])
    await userEvent.click(within(rail).getByRole('button', { name: /Grillades/ }))
    expect(within(produits).queryByText('Flag 65 cl')).not.toBeInTheDocument()

    await userEvent.click(within(rail).getByRole('button', { name: /Tout/ }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un produit' }), 'flag')
    expect(within(produits).getAllByRole('listitem')).toHaveLength(1)
  })

  it('dit quand la carte de l’établissement est vide', async () => {
    noteServie(NOTE_T4, [])

    expect(
      await screen.findByRole('heading', { name: 'Aucun produit à vendre pour l’instant' }),
    ).toBeVisible()
  })
})
