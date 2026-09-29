import { describe, expect, it, vi } from 'vitest'
import { ErreurApi } from '../api/ErreurApi'
import { placerErreursServeur, texteOptionnel } from './erreursServeur'

const CHAMPS = ['code', 'nom', 'proprietaire.telephone'] as const

describe('placerErreursServeur', () => {
  it('place chaque champ invalide renvoyé par l’API sous le champ du formulaire', () => {
    const definirErreur = vi.fn()
    const erreur = new ErreurApi({
      statut: 400,
      code: 'REQUETE_INVALIDE',
      message: 'x',
      champs: [
        { champ: 'code', message: 'doit respecter le format' },
        { champ: 'proprietaire.telephone', message: 'numéro de téléphone invalide' },
      ],
    })

    const restants = placerErreursServeur(erreur, definirErreur, { champs: CHAMPS })

    expect(definirErreur.mock.calls).toEqual([
      ['code', { type: 'serveur', message: 'doit respecter le format' }],
      ['proprietaire.telephone', { type: 'serveur', message: 'numéro de téléphone invalide' }],
    ])
    expect(restants).toEqual([])
  })

  it('rend les champs que le formulaire ne connaît pas, pour les afficher ailleurs', () => {
    const erreur = new ErreurApi({
      statut: 400,
      code: 'REQUETE_INVALIDE',
      message: 'x',
      champs: [{ champ: 'proprietaire', message: 'un téléphone ou un e-mail est obligatoire' }],
    })

    expect(placerErreursServeur(erreur, vi.fn(), { champs: CHAMPS })).toEqual([
      { champ: 'proprietaire', message: 'un téléphone ou un e-mail est obligatoire' },
    ])
  })

  it('rattache à un champ une erreur métier qui le concerne', () => {
    const definirErreur = vi.fn()
    const erreur = new ErreurApi({
      statut: 409,
      code: 'CODE_ETABLISSEMENT_DEJA_UTILISE',
      message: 'x',
    })

    placerErreursServeur(erreur, definirErreur, {
      champs: CHAMPS,
      codesParChamp: { CODE_ETABLISSEMENT_DEJA_UTILISE: 'code' },
    })

    expect(definirErreur).toHaveBeenCalledWith('code', {
      type: 'serveur',
      message: 'Ce code est déjà utilisé par un autre établissement. Choisissez-en un autre.',
    })
  })

  it('traduit le nom d’un champ de l’API vers celui du formulaire', () => {
    const definirErreur = vi.fn()
    const erreur = new ErreurApi({
      statut: 400,
      code: 'REQUETE_INVALIDE',
      message: 'x',
      champs: [{ champ: 'proprietaire.motDePasseProvisoire', message: 'trop court' }],
    })

    placerErreursServeur(erreur, definirErreur, {
      champs: ['proprietaire.motDePasse'],
      alias: { 'proprietaire.motDePasseProvisoire': 'proprietaire.motDePasse' },
    })

    expect(definirErreur).toHaveBeenCalledWith('proprietaire.motDePasse', {
      type: 'serveur',
      message: 'trop court',
    })
  })

  it('ne fait rien pour une erreur qui n’est pas de l’API', () => {
    const definirErreur = vi.fn()

    expect(placerErreursServeur(new Error('x'), definirErreur, { champs: CHAMPS })).toEqual([])
    expect(definirErreur).not.toHaveBeenCalled()
  })
})

describe('texteOptionnel', () => {
  it('n’envoie pas un champ facultatif laissé vide', () => {
    expect(texteOptionnel('  ')).toBeUndefined()
    expect(texteOptionnel(' Lomé ')).toBe('Lomé')
  })
})
