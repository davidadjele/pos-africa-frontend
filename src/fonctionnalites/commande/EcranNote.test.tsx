import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
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
  DemandeAnnulation,
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

const AFI_ID = '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0301'

/** Toucher une ligne ouvre ses actions ; en choisir une. */
async function choisirPourLaLigne(produit: string, action: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Actions sur ${produit}` }))
  const actions = screen.getByRole('dialog', { name: produit })
  await userEvent.click(within(actions).getByRole('button', { name: new RegExp(`^${action}`) }))
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

    await choisirPourLaLigne('Poulet braisé', 'Consigne pour la préparation')
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

  it('envoie en préparation tout ce qui est à envoyer', async () => {
    let envoyee = false
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/envoi`, () => {
        envoyee = true
        return HttpResponse.json({
          ...NOTE_T4,
          lignes: [
            FLAG_ENVOYE,
            {
              ...POULET_A_ENVOYER,
              statut: 'ENVOYEE',
              envoyeeLe: '2026-09-29T19:40:00Z',
            },
          ],
          version: 4,
        })
      }),
    )
    noteServie()

    const note = await noteEnCours()
    await userEvent.click(
      within(note).getByRole('button', { name: 'Envoyer 2 articles en préparation' }),
    )

    expect(await screen.findByText('2 articles envoyés en préparation à 19:40.')).toBeVisible()
    expect(envoyee).toBe(true)
    expect(within(note).queryByRole('button', { name: /Envoyer/ })).not.toBeInTheDocument()
  })

  it('n’envoie rien quand un article à envoyer vient d’être déclaré épuisé', async () => {
    let carte = [FLAG, POULET]
    serveurMsw.use(
      http.get(`${API}/caisse/carte`, () => HttpResponse.json(carte)),
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/envoi`, () => {
        carte = [
          FLAG,
          { ...POULET, epuise: true, epuisePar: 'Afi M.', epuiseLe: '2026-09-29T20:05:00Z' },
        ]
        return HttpResponse.json(
          { statut: 409, code: 'PRODUIT_EPUISE', message: 'x' },
          { status: 409 },
        )
      }),
      http.get(`${API}/caisse/commandes/${NOTE_T4.id}`, () => HttpResponse.json(NOTE_T4)),
      http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)),
    )
    caisseOuverte(`/caisse/notes/${NOTE_T4.id}`)

    const note = await noteEnCours()
    await userEvent.click(within(note).getByRole('button', { name: /Envoyer/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Rien n’est parti. Poulet braisé a été déclaré épuisé (Afi M., 20:05) : retirez-le de la note, puis renvoyez.',
    )
    const lignes = within(note).getByRole('list', { name: 'Articles de la note' })
    expect(lignes).toHaveTextContent('Poulet braiséÉpuisé')
  })

  it('annule un article envoyé avec son motif, après la validation d’un gérant', async () => {
    const recues: DemandeAnnulation[] = []
    serveurMsw.use(
      http.post(
        `${API}/caisse/commandes/${NOTE_T4.id}/lignes/${FLAG_ENVOYE.id}/annulation`,
        async ({ request }) => {
          const demande = (await request.json()) as DemandeAnnulation
          recues.push(demande)
          if (demande.validationId === undefined) {
            return HttpResponse.json(
              { statut: 403, code: 'VALIDATION_REQUISE', message: 'x' },
              { status: 403 },
            )
          }
          return HttpResponse.json({
            ...NOTE_T4,
            lignes: [
              {
                ...FLAG_ENVOYE,
                statut: 'ANNULEE',
                annuleeLe: '2026-09-29T19:40:00Z',
                motifAnnulation: 'NON_SERVIE',
                annulationValideePar: 'Afi M.',
              },
              POULET_A_ENVOYER,
            ],
            total: 9000,
            version: 4,
          })
        },
      ),
      http.get(`${API}/caisse/validateurs`, () =>
        HttpResponse.json([
          {
            utilisateurId: AFI_ID,
            prenom: 'Afi',
            nomCourt: 'Afi M.',
            role: 'GERANT',
            bloque: false,
          },
        ]),
      ),
      http.post(`${API}/caisse/validations`, () =>
        HttpResponse.json(
          { id: 'a1b20000-0000-4000-8000-000000000001', expireLe: '2026-09-29T19:41:00Z' },
          { status: 201 },
        ),
      ),
    )
    noteServie()

    await choisirPourLaLigne('Flag 65 cl', 'Annuler')
    const annulation = screen.getByRole('dialog', { name: 'Annuler Flag 65 cl ?' })
    expect(annulation).toHaveTextContent('T4, Terrasse, envoyé en préparation à 19:02.')
    await userEvent.click(
      within(annulation).getByRole('radio', { name: 'Non servie (trop d’attente)' }),
    )
    await userEvent.click(within(annulation).getByRole('button', { name: 'Annuler 1 article' }))

    const validation = await screen.findByRole('dialog', { name: 'Annuler 1 Flag 65 cl ?' })
    expect(validation).toHaveTextContent(
      'demandé par Kossi A. pour le motif : Non servie (trop d’attente).',
    )
    await userEvent.click(await within(validation).findByRole('button', { name: /Afi M\./ }))
    for (const chiffre of '5937') {
      await userEvent.click(within(validation).getByRole('button', { name: chiffre }))
    }
    await userEvent.click(within(validation).getByRole('button', { name: 'Valider' }))

    const lignes = within(await noteEnCours()).getByRole('list', { name: 'Articles de la note' })
    expect(
      await within(lignes).findByText(
        'Annulé à 19:40, Non servie (trop d’attente). Validé par Afi M.',
      ),
    ).toBeVisible()
    expect(recues).toEqual([
      { quantite: 1, motif: 'NON_SERVIE' },
      { quantite: 1, motif: 'NON_SERVIE', validationId: 'a1b20000-0000-4000-8000-000000000001' },
    ])
  })

  it('demande de préciser le motif « Autre »', async () => {
    noteServie()

    await choisirPourLaLigne('Flag 65 cl', 'Annuler')
    const annulation = screen.getByRole('dialog', { name: 'Annuler Flag 65 cl ?' })
    await userEvent.click(within(annulation).getByRole('button', { name: 'Annuler 1 article' }))
    expect(annulation).toHaveTextContent('Choisissez un motif.')
    await userEvent.click(within(annulation).getByRole('radio', { name: 'Autre' }))
    await userEvent.click(within(annulation).getByRole('button', { name: 'Annuler 1 article' }))
    expect(
      within(annulation).getByRole('textbox', { name: /Précisez le motif/ }),
    ).toHaveAccessibleDescription('Précisez le motif.')
  })

  it('dit qui a pris un article sur la note d’un collègue', async () => {
    noteServie({
      ...NOTE_T4,
      lignes: [FLAG_ENVOYE, { ...POULET_A_ENVOYER, ajouteePar: 'Essi D.' }],
    })

    const lignes = within(await noteEnCours()).getByRole('list', { name: 'Articles de la note' })
    expect(lignes).toHaveTextContent('À envoyer, ajouté par Essi D.')
    expect(lignes).not.toHaveTextContent('ajouté par Kossi A.')
  })

  it('ouvre l’encaissement pour qui a le droit d’encaisser', async () => {
    serveurMsw.use(
      http.get(`${API}/caisse/commandes/${NOTE_T4.id}`, () => HttpResponse.json(NOTE_T4)),
      http.get(`${API}/caisse/carte`, () => HttpResponse.json([FLAG, POULET])),
      http.get(`${API}/caisse/ouverture`, () => HttpResponse.json({ operateurs: [] })),
      http.get(`${API}/caisse/commandes/${NOTE_T4.id}/encaissement`, () =>
        HttpResponse.json({
          commandeId: NOTE_T4.id,
          numero: 42,
          total: 10_200,
          paye: 0,
          reste: 10_200,
          payee: false,
          paiements: [],
        }),
      ),
    )
    caisseOuverte(`/caisse/notes/${NOTE_T4.id}`, {
      permissions: ['COMMANDE_CREER', 'PAIEMENT_ENCAISSER'],
    })

    const note = await noteEnCours()
    await userEvent.click(within(note).getByRole('button', { name: /Encaisser/ }))

    expect(await screen.findByRole('heading', { name: 'Encaisser T4' })).toBeVisible()
  })

  it('laisse l’encaissement au caissier', async () => {
    noteServie()

    const note = await noteEnCours()
    expect(within(note).getByRole('button', { name: /Encaisser/ })).toBeDisabled()
    expect(note).toHaveTextContent('Un caissier encaisse cette note.')
  })

  it('verrouille une note entamée par un paiement', async () => {
    noteServie({ ...NOTE_T4, totalPaye: 5000 })

    const note = await noteEnCours()
    expect(note).toHaveTextContent('5 000 F déjà payés : la note ne se modifie plus.')
    expect(within(note).queryByRole('button', { name: /Un de plus/ })).not.toBeInTheDocument()
    expect(within(note).queryByRole('button', { name: /Actions sur/ })).not.toBeInTheDocument()
  })

  it('marque servi un article envoyé, ou tout d’un coup', async () => {
    const servi = { ...FLAG_ENVOYE, servieLe: '2026-09-29T19:21:00Z' }
    const lignes: string[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/lignes/${FLAG_ENVOYE.id}/service`, () => {
        lignes.push(FLAG_ENVOYE.id)
        return HttpResponse.json({ ...NOTE_T4, lignes: [servi, POULET_A_ENVOYER] })
      }),
    )
    noteServie()

    const note = await noteEnCours()
    expect(note).toHaveTextContent('1 article à servir')
    await userEvent.click(within(note).getByRole('button', { name: 'Servi : Flag 65 cl' }))

    expect(await within(note).findByText(/servi à 19:21/)).toBeVisible()
    expect(within(note).queryByRole('button', { name: 'Tout servi' })).not.toBeInTheDocument()
    expect(lignes).toEqual([FLAG_ENVOYE.id])
  })

  it('remet au client une commande payée du comptoir', async () => {
    let remise = false
    const payee = {
      ...NOTE_VIDE,
      statut: 'PAYEE' as const,
      lignes: [FLAG_ENVOYE],
      total: 1200,
      totalPaye: 1200,
    }
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_VIDE.id}/service`, () => {
        remise = true
        return HttpResponse.json({
          ...payee,
          lignes: [{ ...FLAG_ENVOYE, servieLe: '2026-09-29T20:45:00Z' }],
        })
      }),
    )
    noteServie(payee)

    const note = await noteEnCours()
    await userEvent.click(within(note).getByRole('button', { name: 'Remise au client' }))

    expect(await within(note).findByText(/servi à 20:45/)).toBeVisible()
    expect(remise).toBe(true)
  })

  it('filtre la carte par catégorie et par nom', async () => {
    noteServie()

    const produits = await screen.findByRole('list', { name: 'Produits' })
    const rail = screen.getByRole('navigation', { name: 'Catégories' })
    expect(
      within(rail)
        .getAllByRole('button')
        .map((bouton) => bouton.textContent),
    ).toEqual(['Tout2 produits', 'Bières1 produit', 'Grillades1 produit'])
    await userEvent.click(within(rail).getByRole('button', { name: /Grillades/ }))
    expect(within(produits).queryByText('Flag 65 cl')).not.toBeInTheDocument()

    await userEvent.click(within(rail).getByRole('button', { name: /Tout/ }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un produit' }), 'flag')
    expect(within(produits).getAllByRole('listitem')).toHaveLength(1)
  })

  it('montre sur la tuile la quantité à envoyer, et en retire une avec « − »', async () => {
    const demandes: { methode: string; corps: unknown }[] = []
    noteServie({
      ...NOTE_T4,
      lignes: [
        {
          ...POULET_A_ENVOYER,
          quantite: 2,
        },
      ],
    })
    serveurMsw.use(
      http.put(`${API}/caisse/commandes/:id/lignes/:ligne`, async ({ request }) => {
        demandes.push({ methode: 'PUT', corps: await request.json() })
        return HttpResponse.json(NOTE_T4)
      }),
    )

    const produits = await screen.findByRole('list', { name: 'Produits' })
    const tuile = within(produits).getByRole('button', { name: /Poulet braisé/ })
    expect(within(tuile).getByLabelText('2 sur la note')).toHaveTextContent('2')
    await userEvent.click(within(produits).getByRole('button', { name: 'En retirer un' }))

    await vi.waitFor(() => {
      expect(demandes).toEqual([{ methode: 'PUT', corps: { quantite: 1 } }])
    })
  })

  it('montre les notes ouvertes en bas, la note courante en évidence, pour passer d’une table à l’autre', async () => {
    noteServie()
    serveurMsw.use(http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)))

    const ruban = await screen.findByRole('navigation', { name: 'Notes ouvertes' })
    const t4 = within(ruban).getByRole('link', { name: /^T4/ })
    expect(t4).toHaveAttribute('aria-current', 'page')
    const t7 = within(ruban).getByRole('link', { name: /^T7/ })
    expect(t7).toHaveTextContent('Essi D.')
    expect(t7).toHaveAttribute('href', '/caisse/notes/c0000000-0000-4000-8000-000000000041')
  })

  it('dit quand la carte de l’établissement est vide', async () => {
    noteServie(NOTE_T4, [])

    expect(
      await screen.findByRole('heading', { name: 'Aucun produit à vendre pour l’instant' }),
    ).toBeVisible()
  })
})
