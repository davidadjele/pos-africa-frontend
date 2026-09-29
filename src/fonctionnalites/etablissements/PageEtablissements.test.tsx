import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_SERVEUR, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { EtablissementResume } from '../../partage/api/contrat'

const BE_KPOTA: EtablissementResume = {
  id: '9a1f0c2e-0000-4b8e-8f6a-000000000001',
  code: 'BE',
  nom: 'Bè Kpota',
  ville: 'Lomé',
  adresse: 'Rue de la Plage',
  fuseauHoraire: 'Africa/Lome',
  actif: true,
  version: 0,
}

/** Backend simulé : la liste reflète les créations et modifications. */
function etablissementsEnMemoire(depart: EtablissementResume[]) {
  const liste = [...depart]
  serveurMsw.use(
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: liste, page: 0, taille: 50, total: liste.length }),
    ),
  )
  return liste
}

async function ouvrirEtablissements(moi = MOI_TANTI) {
  sessionOuverte(moi)
  const application = ouvrir('/gestion/etablissements')
  await screen.findByRole('heading', { level: 1, name: 'Établissements' })
  return application
}

describe('PageEtablissements', () => {
  it('liste les établissements avec leur code, nom, ville et fuseau', async () => {
    etablissementsEnMemoire([BE_KPOTA])
    await ouvrirEtablissements()

    const tableau = await screen.findByRole('table', { name: 'Établissements de l’entreprise' })
    expect(
      within(tableau)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Code', 'Nom', 'Ville', 'Fuseau horaire', 'Actions'])
    const ligne = within(tableau).getAllByRole('row')[1]
    expect(ligne).toHaveTextContent('BE')
    expect(ligne).toHaveTextContent('Bè Kpota')
    expect(ligne).toHaveTextContent('Rue de la Plage')
    expect(ligne).toHaveTextContent('Lomé')
    expect(ligne).toHaveTextContent('Lomé (Africa/Lome)')
  })

  it('invite à ajouter le premier établissement quand il n’y en a aucun', async () => {
    etablissementsEnMemoire([])
    await ouvrirEtablissements()

    expect(await screen.findByRole('heading', { name: 'Aucun établissement' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Ajouter un établissement' })).toHaveLength(1)
  })

  it('présente une panne de chargement avec un bouton pour réessayer, pas un état vide', async () => {
    serveurMsw.use(
      http.get(`${API}/etablissements`, () =>
        HttpResponse.json(
          { statut: 500, code: 'ERREUR_INTERNE', message: 'x', traceId: 'c0ffee42' },
          { status: 500 },
        ),
      ),
    )
    await ouvrirEtablissements()

    expect(await screen.findByRole('alert')).toHaveTextContent('Code pour le support : c0ffee42')
    expect(screen.queryByText('Aucun établissement')).not.toBeInTheDocument()

    etablissementsEnMemoire([BE_KPOTA])
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('table')).toHaveTextContent('Bè Kpota')
  })

  it('crée un établissement et le montre dans la liste', async () => {
    const liste = etablissementsEnMemoire([BE_KPOTA])
    let corps: unknown = null
    serveurMsw.use(
      http.post(`${API}/etablissements`, async ({ request }) => {
        corps = await request.json()
        const cree = {
          ...(corps as EtablissementResume),
          id: '9a1f0c2e-0000-4b8e-8f6a-000000000002',
          actif: true,
          version: 0,
        }
        liste.push(cree)
        return HttpResponse.json(cree, { status: 201 })
      }),
    )
    await ouvrirEtablissements()

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un établissement' }))
    const formulaire = screen.getByRole('form', { name: 'Nouvel établissement' })
    await userEvent.type(within(formulaire).getByLabelText(/^Code/), 'ag')
    await userEvent.type(within(formulaire).getByLabelText(/^Nom/), 'Agbalépédo')
    await userEvent.type(within(formulaire).getByLabelText(/^Ville/), 'Lomé')
    expect(within(formulaire).getByLabelText(/^Fuseau horaire/)).toHaveValue('Africa/Lome')
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’établissement' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Agbalépédo a été créé.')
    expect(corps).toEqual({
      code: 'AG',
      nom: 'Agbalépédo',
      ville: 'Lomé',
      fuseauHoraire: 'Africa/Lome',
    })
    expect(await screen.findByRole('cell', { name: 'AG' })).toBeVisible()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })

  it('vérifie le code et le nom avant d’envoyer', async () => {
    etablissementsEnMemoire([BE_KPOTA])
    await ouvrirEtablissements()

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un établissement' }))
    await userEvent.type(screen.getByLabelText(/^Code/), 'B')
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’établissement' }))

    expect(screen.getByLabelText(/^Code/)).toHaveAccessibleDescription(
      '2 à 10 lettres majuscules ou chiffres, sans espace.',
    )
    expect(screen.getByLabelText(/^Nom/)).toHaveAccessibleDescription('Ce champ est obligatoire.')
  })

  it('place sous le champ un code déjà utilisé et les champs refusés par le serveur', async () => {
    etablissementsEnMemoire([BE_KPOTA])
    serveurMsw.use(
      http.post(`${API}/etablissements`, async ({ request }) => {
        const { code } = (await request.json()) as { code: string }
        return code === 'BE'
          ? HttpResponse.json(
              {
                statut: 409,
                code: 'CODE_ETABLISSEMENT_DEJA_UTILISE',
                message: 'x',
                // Le backend vise aussi le champ, avec son message non traduit : la traduction doit l'emporter.
                champs: [{ champ: 'code', message: 'message du serveur, non traduit' }],
              },
              { status: 409 },
            )
          : HttpResponse.json(
              {
                statut: 400,
                code: 'REQUETE_INVALIDE',
                message: 'x',
                champs: [{ champ: 'fuseauHoraire', message: 'fuseau horaire inconnu' }],
              },
              { status: 400 },
            )
      }),
    )
    await ouvrirEtablissements()

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un établissement' }))
    await userEvent.type(screen.getByLabelText(/^Code/), 'BE')
    await userEvent.type(screen.getByLabelText(/^Nom/), 'Bè Kpota bis')
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’établissement' }))

    await waitFor(() => {
      expect(screen.getByLabelText(/^Code/)).toHaveAccessibleDescription(
        'Ce code est déjà utilisé par un autre établissement. Choisissez-en un autre.',
      )
    })

    await userEvent.clear(screen.getByLabelText(/^Code/))
    await userEvent.type(screen.getByLabelText(/^Code/), 'BE2')
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’établissement' }))

    await waitFor(() => {
      expect(screen.getByLabelText(/^Fuseau horaire/)).toHaveAccessibleDescription(
        'fuseau horaire inconnu',
      )
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Corrigez les champs indiqués')
  })

  it('modifie un établissement en envoyant la version connue', async () => {
    const liste = etablissementsEnMemoire([BE_KPOTA])
    let corps: unknown = null
    serveurMsw.use(
      http.put(`${API}/etablissements/${BE_KPOTA.id}`, async ({ request }) => {
        corps = await request.json()
        liste[0] = { ...BE_KPOTA, ...(corps as object), version: 1 }
        return HttpResponse.json(liste[0])
      }),
    )
    await ouvrirEtablissements()

    await userEvent.click(await screen.findByRole('button', { name: 'Modifier Bè Kpota' }))
    const formulaire = screen.getByRole('form', { name: 'Modifier Bè Kpota' })
    expect(within(formulaire).getByLabelText(/^Code/)).toHaveValue('BE')
    await userEvent.clear(within(formulaire).getByLabelText(/^Nom/))
    await userEvent.type(within(formulaire).getByLabelText(/^Nom/), 'Bè Kpota Plage')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Bè Kpota Plage a été modifié.')
    expect(corps).toEqual({
      code: 'BE',
      nom: 'Bè Kpota Plage',
      ville: 'Lomé',
      adresse: 'Rue de la Plage',
      fuseauHoraire: 'Africa/Lome',
      version: 0,
    })
  })

  it('recharge un établissement modifié ailleurs au lieu de l’écraser', async () => {
    const liste = etablissementsEnMemoire([BE_KPOTA])
    const versionsEnvoyees: number[] = []
    serveurMsw.use(
      http.put(`${API}/etablissements/${BE_KPOTA.id}`, async ({ request }) => {
        const { version } = (await request.json()) as { version: number }
        versionsEnvoyees.push(version)
        if (version !== liste[0]?.version) {
          return HttpResponse.json(
            { statut: 409, code: 'CONFLIT_MODIFICATION', message: 'x' },
            { status: 409 },
          )
        }
        return HttpResponse.json({ ...liste[0], version: version + 1 })
      }),
    )
    await ouvrirEtablissements()
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier Bè Kpota' }))
    // Pendant ce temps, un gérant renomme l'établissement sur une autre tablette.
    liste[0] = { ...BE_KPOTA, nom: 'Bè Kpota Plage', version: 1 }
    await userEvent.clear(screen.getByLabelText(/^Ville/))
    await userEvent.type(screen.getByLabelText(/^Ville/), 'Baguida')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Cet élément a été modifié sur un autre appareil. Il a été rechargé : vérifiez-le puis recommencez.',
    )
    await waitFor(() => {
      expect(screen.getByLabelText(/^Nom/)).toHaveValue('Bè Kpota Plage')
    })
    expect(screen.getByLabelText(/^Ville/)).toHaveValue('Lomé')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))
    await screen.findByText('Bè Kpota Plage a été modifié.')
    expect(versionsEnvoyees).toEqual([0, 1])
  })

  it('masque la création et la modification sans la permission de gérer les établissements', async () => {
    etablissementsEnMemoire([BE_KPOTA])
    await ouvrirEtablissements(MOI_SERVEUR)

    const tableau = await screen.findByRole('table')
    expect(tableau).toHaveTextContent('Bè Kpota')
    expect(
      screen.queryByRole('button', { name: 'Ajouter un établissement' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Modifier/ })).not.toBeInTheDocument()
    expect(within(tableau).queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument()
  })

  it('dit à un utilisateur sans permission qui peut ajouter un établissement', async () => {
    etablissementsEnMemoire([])
    await ouvrirEtablissements(MOI_SERVEUR)

    expect(
      await screen.findByText(
        'Seul un responsable avec le droit de gérer les établissements peut en ajouter.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Ajouter un établissement' }),
    ).not.toBeInTheDocument()
  })
})
