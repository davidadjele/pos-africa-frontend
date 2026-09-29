import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, CAISSE_BAR, ouvrir, tablette } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { ProfilCaisse, SessionCaisseCourante } from '../../partage/api/contrat'

const KOSSI: ProfilCaisse = {
  utilisateurId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0201',
  prenom: 'Kossi',
  nomCourt: 'Kossi A.',
  role: 'SERVEUR',
  bloque: false,
  pinAChanger: false,
}
const YAWA: ProfilCaisse = {
  utilisateurId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0202',
  prenom: 'Yawa',
  nomCourt: 'Yawa M.',
  role: 'SERVEUR',
  bloque: true,
  pinAChanger: false,
}
const ESSI: ProfilCaisse = {
  utilisateurId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0203',
  prenom: 'Essi',
  nomCourt: 'Essi D.',
  role: 'CAISSIER',
  bloque: false,
  pinAChanger: true,
}
const SESSION_KOSSI: SessionCaisseCourante = {
  utilisateurId: KOSSI.utilisateurId,
  prenom: 'Kossi',
  nomCourt: 'Kossi A.',
  role: 'SERVEUR',
  permissions: ['COMMANDE_CREER'],
}

function erreur(statut: number, code: string) {
  return HttpResponse.json({ statut, code, message: 'x', traceId: 'trace-1' }, { status: statut })
}

/** Tablette de Bè Kpota et son personnel ; renvoie les corps des requêtes envoyées. */
function tabletteAvecPersonnel(reponseConnexion: () => Response) {
  const envois: { chemin: string; corps: unknown }[] = []
  tablette(CAISSE_BAR)
  serveurMsw.use(
    http.get(`${API}/appareil/personnel`, () => HttpResponse.json([KOSSI, YAWA, ESSI])),
    http.post(`${API}/appareil/connexion`, async ({ request }) => {
      envois.push({ chemin: '/appareil/connexion', corps: await request.json() })
      return reponseConnexion()
    }),
    http.post(`${API}/appareil/pin`, async ({ request }) => {
      envois.push({ chemin: '/appareil/pin', corps: await request.json() })
      return HttpResponse.json({ statut: 'CONNECTE', jetonAcces: 'eyJ.caisse' })
    }),
    http.get(`${API}/caisse/moi`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer eyJ.caisse'
        ? HttpResponse.json(SESSION_KOSSI)
        : erreur(401, 'NON_AUTHENTIFIE'),
    ),
  )
  return envois
}

async function taper(code: string) {
  for (const chiffre of code) {
    await userEvent.click(screen.getByRole('button', { name: chiffre }))
  }
}

async function choisirProfil(nom: RegExp) {
  await userEvent.click(await screen.findByRole('button', { name: nom }))
}

describe('Prise de caisse', () => {
  it('présente le personnel de la tablette, les profils bloqués et le délai de verrouillage', async () => {
    tabletteAvecPersonnel(() => erreur(401, 'PIN_INCORRECT'))
    ouvrir('/caisse')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Qui prend la caisse ?' }),
    ).toBeVisible()
    expect(await screen.findByRole('button', { name: /Kossi A\./ })).toHaveTextContent('Serveur')
    expect(screen.getByRole('button', { name: /Yawa M\./ })).toHaveTextContent('Bloqué')
    expect(
      screen.getByText(
        'La caisse se verrouille seule après 3 minutes sans activité et revient ici.',
      ),
    ).toBeVisible()
  })

  it('ouvre la caisse avec le PIN et affiche qui la tient', async () => {
    const envois = tabletteAvecPersonnel(() =>
      HttpResponse.json({ statut: 'CONNECTE', jetonAcces: 'eyJ.caisse' }),
    )
    ouvrir('/caisse')

    await choisirProfil(/Kossi A\./)
    await taper('4827')
    expect(screen.getByRole('status', { name: '4 chiffres saisis' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse' }))

    const barre = await screen.findByRole('banner')
    await waitFor(() => {
      expect(barre).toHaveTextContent('Kossi A.')
    })
    expect(envois).toEqual([
      { chemin: '/appareil/connexion', corps: { utilisateurId: KOSSI.utilisateurId, pin: '4827' } },
    ])
    expect(await screen.findByRole('heading', { level: 1, name: /Aucun produit/ })).toBeVisible()

    await userEvent.click(within(barre).getByRole('button', { name: 'Changer d’utilisateur' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Qui prend la caisse ?' }),
    ).toBeVisible()
  })

  it('annonce 6 cases pour un PIN temporaire, et ne trahit pas la longueur d’un code choisi', async () => {
    tabletteAvecPersonnel(() => erreur(401, 'PIN_INCORRECT'))
    ouvrir('/caisse')
    const cases = () =>
      screen.getByRole('status', { name: /chiffre/ }).querySelectorAll('[data-case]')

    await choisirProfil(/Essi D\./)
    expect(cases()).toHaveLength(6)

    await userEvent.click(screen.getByRole('button', { name: 'Choisir un autre profil' }))
    await choisirProfil(/Kossi A\./)
    expect(cases()).toHaveLength(0)
    await taper('48')
    expect(cases()).toHaveLength(2)
  })

  it('refuse un code erroné et vide la saisie', async () => {
    tabletteAvecPersonnel(() => erreur(401, 'PIN_INCORRECT'))
    ouvrir('/caisse')

    await choisirProfil(/Kossi A\./)
    await taper('1111')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Code incorrect. Au 5e code erroné, le profil est bloqué.',
    )
    expect(screen.getByRole('status', { name: '0 chiffre saisi' })).toBeInTheDocument()
  })

  it('explique comment débloquer un profil bloqué, sans clavier', async () => {
    tabletteAvecPersonnel(() => erreur(423, 'PROFIL_BLOQUE'))
    ouvrir('/caisse')

    await choisirProfil(/Yawa M\./)

    const panneau = await screen.findByRole('region', { name: 'Yawa M.' })
    expect(within(panneau).getByText('Profil bloqué')).toBeVisible()
    expect(panneau).toHaveTextContent('« Réinitialiser le PIN » de Yawa')
    expect(within(panneau).queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    await userEvent.click(within(panneau).getByRole('button', { name: 'Choisir un autre profil' }))
    expect(screen.queryByRole('region', { name: 'Yawa M.' })).not.toBeInTheDocument()
  })

  it('bascule sur le panneau de blocage au 5e code erroné', async () => {
    tabletteAvecPersonnel(() => erreur(423, 'PROFIL_BLOQUE'))
    ouvrir('/caisse')

    await choisirProfil(/Kossi A\./)
    await taper('0000')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse' }))

    const panneau = await screen.findByRole('region', { name: 'Kossi A.' })
    expect(await within(panneau).findByText('Profil bloqué')).toBeVisible()
  })

  it('fait choisir un code personnel après le PIN temporaire, en deux saisies', async () => {
    const envois = tabletteAvecPersonnel(() => HttpResponse.json({ statut: 'PIN_A_CHANGER' }))
    ouvrir('/caisse')

    await choisirProfil(/Essi D\./)
    await taper('610294')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Choisissez votre code personnel' }),
    ).toBeVisible()
    expect(screen.getByText('Bienvenue, Essi')).toBeVisible()

    await taper('1234')
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Code trop facile à deviner')

    await taper('4827')
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(screen.getByText('Retapez votre nouveau code')).toBeVisible()
    await taper('4828')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mon code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Les deux codes ne correspondent pas',
    )
    expect(screen.getByText('Tapez votre nouveau code')).toBeVisible()

    await taper('4827')
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    await taper('4827')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mon code' }))

    await waitFor(() => {
      expect(envois.at(-1)).toEqual({
        chemin: '/appareil/pin',
        corps: { utilisateurId: ESSI.utilisateurId, pinActuel: '610294', nouveauPin: '4827' },
      })
    })
    expect(await screen.findByRole('button', { name: 'Changer d’utilisateur' })).toBeVisible()
  })
})
