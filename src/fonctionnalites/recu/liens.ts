/**
 * Le reçu en ligne. Le lien est imprimé dans le QR code et part par WhatsApp : il doit viser l'adresse publique de
 * production (VITE_ADRESSE_PUBLIQUE), pas celle où tourne la tablette. Sans elle, en développement, l'adresse de la
 * page.
 */
export function lienRecu(jeton: string): string {
  const configuree = import.meta.env.VITE_ADRESSE_PUBLIQUE ?? ''
  const adresse = configuree === '' ? globalThis.location.origin : configuree
  return `${adresse.endsWith('/') ? adresse.slice(0, -1) : adresse}/r/${jeton}`
}

/** Une conversation WhatsApp ouverte au numéro, message prêt : le caissier n'a plus qu'à l'envoyer. */
export function lienWhatsApp(telephoneE164: string, message: string): string {
  return `https://wa.me/${telephoneE164.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`
}
