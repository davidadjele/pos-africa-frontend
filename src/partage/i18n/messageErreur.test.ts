import { afterEach, describe, expect, it } from 'vitest'
import { ErreurApi } from '../api/ErreurApi'
import { i18n } from './i18n'
import { messageErreur } from './messageErreur'
import { CODES_ERREUR } from '../api/ReponseErreur'
import fr from './fr.json'
import en from './en.json'

describe('messageErreur', () => {
  afterEach(async () => {
    await i18n.changeLanguage('fr')
  })

  it('traduit le code d’erreur plutôt que d’afficher le message du serveur', () => {
    const erreur = new ErreurApi({
      statut: 422,
      code: 'STOCK_INSUFFISANT',
      message: 'Stock insuffisant pour cet article.',
    })

    expect(messageErreur(erreur)).toBe(
      'Stock insuffisant pour cet article. Retirez-le de la note ou choisissez un autre produit.',
    )
  })

  it('traduit dans la langue choisie', async () => {
    await i18n.changeLanguage('en')
    const erreur = new ErreurApi({ statut: 0, code: 'RESEAU_INDISPONIBLE', message: 'x' })

    expect(messageErreur(erreur)).toBe(
      'The server cannot be reached. Check the connection and try again.',
    )
  })

  it('reprend le message du serveur pour un code qu’il ne connaît pas encore', () => {
    const erreur = new ErreurApi({
      statut: 422,
      code: 'SESSION_CAISSE_FERMEE',
      message: 'La session de caisse est fermée. Ouvrez-la pour encaisser.',
    })

    expect(messageErreur(erreur)).toBe('La session de caisse est fermée. Ouvrez-la pour encaisser.')
  })

  it('présente toute autre erreur comme une erreur interne, sans détail technique', () => {
    expect(messageErreur(new TypeError('undefined is not a function'))).toBe(
      fr.erreurs.ERREUR_INTERNE,
    )
  })

  it('a un message français et anglais pour chaque code d’erreur connu', () => {
    for (const code of CODES_ERREUR) {
      expect(fr.erreurs[code], code).toBeTruthy()
      expect(en.erreurs[code], code).toBeTruthy()
    }
  })
})
