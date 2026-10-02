import { describe, expect, it } from 'vitest'
import { lienRecu, lienWhatsApp } from './liens'

describe('liens du reçu', () => {
  it('ouvre le reçu en ligne sur l’adresse de l’application', () => {
    expect(lienRecu('k3F9qL2m')).toBe(`${window.location.origin}/r/k3F9qL2m`)
  })

  it('écrit au numéro WhatsApp, sans le +, avec le message prêt à envoyer', () => {
    expect(lienWhatsApp('+22890112345', 'Votre reçu BE-000127 : https://tonti.africa/r/k3F9')).toBe(
      'https://wa.me/22890112345?text=Votre%20re%C3%A7u%20BE-000127%20%3A%20https%3A%2F%2Ftonti.africa%2Fr%2Fk3F9',
    )
  })
})
