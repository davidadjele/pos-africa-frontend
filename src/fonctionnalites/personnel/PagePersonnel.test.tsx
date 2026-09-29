import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type {
  EmployeResume,
  EtablissementResume,
  ReponseMoi,
  ResultatEmploye,
  RoleAttribuable,
} from '../../partage/api/contrat'

const BE_KPOTA: EtablissementResume = {
  id: '9a1f0c2e-0000-4b8e-8f6a-000000000001',
  code: 'BE',
  nom: 'Bè Kpota',
  ville: 'Lomé',
  fuseauHoraire: 'Africa/Lome',
  delaiVerrouillageMinutes: 3,
  actif: true,
  version: 0,
}
const AGBALEPEDO: EtablissementResume = {
  ...BE_KPOTA,
  id: '9a1f0c2e-0000-4b8e-8f6a-000000000002',
  code: 'AG',
  nom: 'Agbalépédo',
}

const ROLES_PROPRIETAIRE: RoleAttribuable[] = [
  { code: 'ADMIN', touteLEntreprise: true, attribuable: true, backOffice: true },
  { code: 'CAISSIER', touteLEntreprise: false, attribuable: true, backOffice: false },
  { code: 'CUISINE', touteLEntreprise: false, attribuable: true, backOffice: false },
  { code: 'GERANT', touteLEntreprise: false, attribuable: true, backOffice: true },
  { code: 'SERVEUR', touteLEntreprise: false, attribuable: true, backOffice: false },
]

const TANTI: EmployeResume = {
  id: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0101',
  prenom: 'Tanti',
  nom: 'Akouvi',
  actif: true,
  version: 0,
  telephone: '+22890112345',
  backOffice: true,
  pinAChanger: false,
  gerable: false,
  affectations: [{ role: 'PROPRIETAIRE' }],
}
const KOSSI: EmployeResume = {
  id: '5b1e0000-0000-4000-8000-000000000001',
  prenom: 'Kossi',
  nom: 'Agbeko',
  actif: true,
  version: 0,
  backOffice: false,
  pinAChanger: true,
  gerable: true,
  affectations: [{ etablissementId: BE_KPOTA.id, role: 'SERVEUR' }],
}

const TELEPHONE_DEJA_INSCRIT = '90 44 55 66'

function backendSimule({
  employes = [TANTI, KOSSI],
  roles = ROLES_PROPRIETAIRE,
}: { employes?: EmployeResume[]; roles?: RoleAttribuable[] } = {}) {
  const requetes: { chemin: string; corps: unknown }[] = []
  serveurMsw.use(
    http.get(`${API}/personnel`, () =>
      HttpResponse.json({ elements: employes, page: 0, taille: 50, total: employes.length }),
    ),
    http.get(`${API}/roles`, () => HttpResponse.json(roles)),
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: [AGBALEPEDO, BE_KPOTA], page: 0, taille: 50, total: 2 }),
    ),
    http.post(`${API}/personnel`, async ({ request }) => {
      const corps = (await request.json()) as { prenom: string; nom: string; telephone?: string }
      requetes.push({ chemin: '/personnel', corps })
      // Ce numéro a déjà un compte Tonti (dans une autre entreprise) : rattaché, sans mot de passe.
      const existant = corps.telephone === TELEPHONE_DEJA_INSCRIT
      const resultat: ResultatEmploye = {
        employe: {
          ...KOSSI,
          prenom: corps.prenom,
          nom: corps.nom,
          backOffice: corps.telephone !== undefined,
        },
        pinTemporaire: '482915',
        ...(corps.telephone === undefined || existant
          ? {}
          : { motDePasseTemporaire: 'kp7mzr4qtx9w' }),
        compteExistant: existant,
      }
      return HttpResponse.json(resultat, { status: 201 })
    }),
    http.post(`${API}/personnel/:id/:action`, ({ params }) => {
      requetes.push({
        chemin: `/personnel/${String(params.id)}/${String(params.action)}`,
        corps: null,
      })
      return params.action === 'pin'
        ? HttpResponse.json({ employe: KOSSI, pinTemporaire: '730264', compteExistant: false })
        : new HttpResponse(null, { status: 204 })
    }),
  )
  return requetes
}

async function ouvrirPersonnel(moi: ReponseMoi = MOI_TANTI) {
  sessionOuverte(moi)
  ouvrir('/gestion/personnel')
  await screen.findByRole('heading', { level: 1, name: 'Personnel' })
}

async function ajouter({
  prenom,
  nom,
  role,
  lieu,
}: {
  prenom: string
  nom: string
  role: string
  lieu: string
}) {
  await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un employé' }))
  const formulaire = await screen.findByRole('form', { name: 'Ajouter un employé' })
  await userEvent.type(within(formulaire).getByLabelText(/^Prénom/), prenom)
  await userEvent.type(within(formulaire).getByLabelText(/^Nom/), nom)
  await userEvent.selectOptions(within(formulaire).getByLabelText(`Rôle à ${lieu}`), role)
  return formulaire
}

/** Les actions secondaires d'une ligne sont dans son menu « Plus d'actions ». */
async function choisirAction(nom: string, action: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Plus d’actions pour ${nom}` }))
  await userEvent.click(screen.getByRole('menuitem', { name: action }))
}

describe('PagePersonnel', () => {
  it('liste le personnel avec le rôle par établissement, l’accès, le PIN et le statut', async () => {
    backendSimule()
    await ouvrirPersonnel()

    const tableau = await screen.findByRole('table', { name: 'Personnel de l’entreprise' })
    const kossi = within(tableau).getByRole('row', { name: /Kossi Agbeko/ })
    expect(kossi).toHaveTextContent('Bè Kpota : Serveur')
    expect(kossi).toHaveTextContent('Caisse seulement')
    expect(kossi).toHaveTextContent('À changer')
    expect(kossi).toHaveTextContent('Actif')
    const tanti = within(tableau).getByRole('row', { name: /Tanti Akouvi/ })
    expect(tanti).toHaveTextContent('Toute l’entreprise : Propriétaire')
    expect(tanti).toHaveTextContent('Back-office')
    expect(within(tanti).queryByRole('button')).not.toBeInTheDocument()
  })

  it('ne nomme pas les établissements hors de son périmètre, mais dit qu’il y en a', async () => {
    backendSimule({
      employes: [
        {
          ...KOSSI,
          gerable: false,
          affectations: [
            { etablissementId: BE_KPOTA.id, role: 'SERVEUR' },
            { etablissementId: '9a1f0c2e-0000-4b8e-8f6a-0000000000ff', role: 'CAISSIER' },
          ],
        },
      ],
    })
    await ouvrirPersonnel()

    const tableau = await screen.findByRole('table', { name: 'Personnel de l’entreprise' })
    const kossi = within(tableau).getByRole('row', { name: /Kossi Agbeko/ })
    expect(kossi).toHaveTextContent('Bè Kpota : Serveur')
    expect(kossi).toHaveTextContent('+ 1 autre établissement')
    expect(kossi).not.toHaveTextContent('Caissier')
  })

  it('ajoute un serveur puis montre son PIN temporaire une seule fois', async () => {
    const requetes = backendSimule()
    await ouvrirPersonnel()

    const formulaire = await ajouter({
      prenom: 'Essi',
      nom: 'Dossou',
      role: 'Serveur',
      lieu: 'Bè Kpota',
    })
    expect(within(formulaire).getByText(/n’ouvre le back-office/)).toBeVisible()
    expect(
      within(formulaire).queryByLabelText('Donner un accès au back-office'),
    ).not.toBeInTheDocument()
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer l’employé' }))

    const dialogue = await screen.findByRole('dialog', { name: 'Codes d’accès de Essi Dossou' })
    expect(within(dialogue).getByText('482')).toBeVisible()
    expect(within(dialogue).getByText('915')).toBeVisible()
    expect(requetes[0]?.corps).toEqual({
      prenom: 'Essi',
      nom: 'Dossou',
      affectations: [{ etablissementId: BE_KPOTA.id, role: 'SERVEUR' }],
    })

    await userEvent.click(within(dialogue).getByRole('button', { name: 'J’ai noté les codes' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Essi Dossou a été ajouté au personnel.')).toBeVisible()
  })

  it('ouvre le back-office à un gérant et montre son mot de passe temporaire', async () => {
    const requetes = backendSimule()
    await ouvrirPersonnel()

    const formulaire = await ajouter({
      prenom: 'Afi',
      nom: 'Mensah',
      role: 'Gérant',
      lieu: 'Bè Kpota',
    })
    await userEvent.click(within(formulaire).getByLabelText('Donner un accès au back-office'))
    expect(within(formulaire).getByText('+228')).toBeVisible()
    await userEvent.type(within(formulaire).getByLabelText(/^Téléphone/), '90 11 23 45')
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer l’employé' }))

    const dialogue = await screen.findByRole('dialog', { name: 'Codes d’accès de Afi Mensah' })
    expect(within(dialogue).getByText('Mot de passe temporaire du back-office')).toBeVisible()
    expect(within(dialogue).getByText('zr4q')).toBeVisible()
    expect(requetes[0]?.corps).toMatchObject({ telephone: '90 11 23 45' })
  })

  it('prévient qu’un numéro avait déjà un compte Tonti, qui garde son mot de passe', async () => {
    backendSimule()
    await ouvrirPersonnel()

    const formulaire = await ajouter({
      prenom: 'Afi',
      nom: 'Mensah',
      role: 'Gérant',
      lieu: 'Bè Kpota',
    })
    await userEvent.click(within(formulaire).getByLabelText('Donner un accès au back-office'))
    await userEvent.type(within(formulaire).getByLabelText(/^Téléphone/), TELEPHONE_DEJA_INSCRIT)
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer l’employé' }))

    const dialogue = await screen.findByRole('dialog', { name: 'Codes d’accès de Afi Mensah' })
    expect(dialogue).toHaveTextContent(
      'Ce numéro ou cet e-mail avait déjà un compte Tonti : Afi Mensah se connectera au back-office avec son mot de passe habituel et verra Maquis Chez Tanti parmi ses entreprises.',
    )
    expect(dialogue).toHaveTextContent(
      'Vérifiez auprès de la personne qu’il s’agit bien de son numéro',
    )
    expect(
      within(dialogue).queryByText('Mot de passe temporaire du back-office'),
    ).not.toBeInTheDocument()
    expect(within(dialogue).getByText('PIN de caisse temporaire')).toBeVisible()
  })

  it('ne propose pas les rôles que la personne connectée ne peut pas donner', async () => {
    backendSimule({
      roles: ROLES_PROPRIETAIRE.map((role) =>
        role.code === 'ADMIN' ? { ...role, attribuable: false } : role,
      ),
    })
    await ouvrirPersonnel()

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un employé' }))
    const formulaire = await screen.findByRole('form', { name: 'Ajouter un employé' })
    expect(
      within(formulaire).queryByRole('radio', { name: /Administrateur/ }),
    ).not.toBeInTheDocument()
    expect(within(formulaire).getByLabelText('Rôle à Bè Kpota')).toBeVisible()
  })

  it('nomme un administrateur pour toute l’entreprise, sans rôle par établissement', async () => {
    const requetes = backendSimule()
    await ouvrirPersonnel()

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un employé' }))
    const formulaire = await screen.findByRole('form', { name: 'Ajouter un employé' })
    await userEvent.type(within(formulaire).getByLabelText(/^Prénom/), 'Yao')
    await userEvent.type(within(formulaire).getByLabelText(/^Nom/), 'Kpodar')
    expect(within(formulaire).getByRole('radio', { name: /^Rôle par établissement/ })).toBeChecked()
    await userEvent.click(
      within(formulaire).getByRole('radio', { name: 'Administrateur de toute l’entreprise' }),
    )

    expect(within(formulaire).queryByLabelText('Rôle à Bè Kpota')).not.toBeInTheDocument()
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer l’employé' }))
    await screen.findByRole('dialog', { name: 'Codes d’accès de Yao Kpodar' })
    expect(requetes[0]?.corps).toMatchObject({ affectations: [{ role: 'ADMIN' }] })
  })

  it('réinitialise le PIN après confirmation et affiche le nouveau une seule fois', async () => {
    const requetes = backendSimule()
    await ouvrirPersonnel()

    await choisirAction('Kossi Agbeko', 'Réinitialiser le PIN')
    const confirmation = await screen.findByRole('dialog', {
      name: 'Réinitialiser le PIN de Kossi Agbeko ?',
    })
    await userEvent.click(
      within(confirmation).getByRole('button', { name: 'Générer un nouveau PIN' }),
    )

    const codes = await screen.findByRole('dialog', { name: 'Nouveau PIN de Kossi Agbeko' })
    expect(within(codes).getByText('730')).toBeVisible()
    expect(requetes.map((requete) => requete.chemin)).toEqual([`/personnel/${KOSSI.id}/pin`])
  })

  it('désactive un employé après une confirmation qui dit ce qu’il perd', async () => {
    const requetes = backendSimule()
    await ouvrirPersonnel()

    await choisirAction('Kossi Agbeko', 'Désactiver')
    const dialogue = await screen.findByRole('dialog', { name: 'Désactiver Kossi Agbeko ?' })
    expect(dialogue).toHaveTextContent('Ses ventes restent à son nom')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Désactiver l’employé' }))

    await waitFor(() => {
      expect(requetes.map((requete) => requete.chemin)).toEqual([
        `/personnel/${KOSSI.id}/desactivation`,
      ])
    })
    expect(await screen.findByText('Kossi Agbeko est désactivé.')).toBeVisible()
  })

  it('dit qu’un rôle est obligatoire quand aucun n’est choisi', async () => {
    const requetes = backendSimule()
    await ouvrirPersonnel()

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un employé' }))
    const formulaire = await screen.findByRole('form', { name: 'Ajouter un employé' })
    expect(within(formulaire).getByText(/Choisissez d’abord un rôle/)).toBeVisible()
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer l’employé' }))

    // Tout ce qui manque s'affiche d'un coup : identité et rôle.
    expect(await within(formulaire).findByText('Choisissez au moins un rôle.')).toBeVisible()
    expect(within(formulaire).getAllByText('Ce champ est obligatoire.')).toHaveLength(2)
    expect(within(formulaire).getByRole('group', { name: 'Rôle' })).toHaveAccessibleDescription(
      'Choisissez au moins un rôle.',
    )
    expect(requetes).toHaveLength(0)
  })

  it('affiche sous le bloc des rôles un refus du serveur qui le vise', async () => {
    backendSimule()
    serveurMsw.use(
      http.post(`${API}/personnel`, () =>
        HttpResponse.json(
          {
            statut: 400,
            code: 'REQUETE_INVALIDE',
            message: 'x',
            champs: [{ champ: 'affectations', message: 'Un seul rôle par établissement.' }],
          },
          { status: 400 },
        ),
      ),
    )
    await ouvrirPersonnel()

    const formulaire = await ajouter({
      prenom: 'Yao',
      nom: 'Kpodar',
      role: 'Caissier',
      lieu: 'Agbalépédo',
    })
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer l’employé' }))

    expect(await within(formulaire).findByText('Un seul rôle par établissement.')).toBeVisible()
  })
})
