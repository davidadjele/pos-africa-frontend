import type { Guide } from '../guides'

export const depannage: Guide = {
  id: 'depannage',
  titre: 'Dépannage',
  role: 'depannage',
  pour: ['Serveur', 'Caissier', 'Gérant', 'Propriétaire'],
  objectif:
    'Savoir quoi faire quand Tonti affiche une mise à jour, une erreur ou une coupure de réseau, quand un PIN est oublié ou qu’une tablette est perdue.',
  exemple:
    'En plein service à Bè Kpota, Kossi a oublié son code et son profil est bloqué. Afi, la gérante, ouvre Personnel sur son téléphone, réinitialise son PIN et lui donne le nouveau code temporaire. Kossi reprend la caisse en choisissant un nouveau code.',
  etapes: [
    {
      titre: 'Une nouvelle version',
      texte:
        'Le bandeau « Une nouvelle version de Tonti est disponible. » s’affiche en bas de l’écran. Tonti ne se recharge jamais seul : terminez l’encaissement en cours, puis touchez **Recharger**.',
    },
    {
      titre: 'Un PIN oublié',
      texte:
        'Après cinq codes erronés, le profil est bloqué. Un gérant ouvre la gestion, **Réglages**, onglet **Personnel**, ouvre le menu d’actions de l’employé, puis **Réinitialiser le PIN** et **Générer un nouveau PIN**. Le nouveau PIN temporaire ne s’affiche qu’une fois : donnez-le à l’employé, qui choisira le sien sur la caisse.',
    },
    {
      titre: 'Le réseau est coupé',
      texte:
        'Tonti enregistre chaque commande et chaque encaissement sur le serveur. Sans réseau, le message « Le serveur est injoignable. Vérifiez la connexion et réessayez. » s’affiche et rien n’est enregistré. Vérifiez le Wi-Fi ou les données mobiles, puis touchez **Réessayer** ou refaites le geste.',
    },
    {
      titre: 'Un message d’erreur',
      texte:
        'Sous le message, une ligne « Code pour le support : » donne un code. Notez-le, ou faites une photo de l’écran, et donnez-le au support : il retrouve votre cas en une recherche.',
    },
    {
      titre: 'Une tablette perdue ou volée',
      texte:
        'Dans la gestion, **Réglages**, onglet **Tablettes**, ouvrez le menu d’actions de la tablette, puis **Révoquer** et **Révoquer la tablette**. Elle est coupée aussitôt. Pour la réutiliser, enregistrez-la de nouveau avec un code.',
    },
  ],
  bonASavoir: [
    'Un employé qui ne voit pas son nom sur la tablette n’a pas de rôle dans cet établissement : ajoutez-le depuis sa fiche, dans **Personnel**.',
    'Un code d’enregistrement de tablette expire au bout de 10 minutes : générez-en un nouveau.',
    'Quand une note a été modifiée sur une autre tablette, Tonti la recharge et vous demande de vérifier avant de recommencer.',
  ],
  problemes: [
    {
      question: 'Le message dit que la caisse de la tablette n’est pas ouverte.',
      reponse:
        'Un caissier ou un gérant ouvre la caisse en comptant le fond du tiroir, au premier encaissement.',
    },
    {
      question: 'Le message dit que je n’ai pas l’autorisation.',
      reponse:
        'Votre rôle ne permet pas cette action : demandez à un gérant, ou passez-lui la caisse avec **Changer d’utilisateur**.',
    },
  ],
}
