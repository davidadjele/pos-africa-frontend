import type { Guide } from '../guides'

export const remisesEtAnnulations: Guide = {
  id: 'remises-et-annulations',
  titre: 'Remises et annulations',
  role: 'caisse',
  pour: ['Serveur', 'Caissier', 'Gérant'],
  objectif:
    'Retirer ou annuler un article, accorder une remise ou un offert, marquer l’addition demandée, changer de table ou annuler une note, avec la validation d’un gérant quand il le faut.',
  exemple:
    'En T4, sur la terrasse, un des deux Poulet braisé tarde : Kossi l’annule pour « Non servie (trop d’attente) » et Afi, la gérante, valide avec son code. Le client demande l’addition, puis s’installe en T5. Après une réclamation, Kossi accorde 500 F de remise sur le poulet, validés par Afi : la note passe à 4 000 F.',
  etapes: [
    {
      titre: 'Retirer ou annuler un article',
      texte:
        'Touchez l’article sur la note. Pas encore envoyé, il se retire librement avec **Retirer de la note**. Déjà envoyé en préparation, touchez **Annuler** : choisissez combien en annuler et le motif, puis **Annuler 1 article**.',
      capture: {
        fichier: 'remises-et-annulations/annuler-article',
        legende:
          'Dialogue « Annuler Poulet braisé ? » : 1 sur 2, motif « Non servie (trop d’attente) », bouton Annuler 1 article.',
      },
    },
    {
      titre: 'La validation d’un gérant',
      texte:
        'Si votre rôle ne permet pas l’action seul, Tonti l’indique d’avance (« validation d’un gérant ») et ouvre un dialogue : le gérant touche son nom, tape son code, puis **Valider**. L’action est enregistrée avec son nom.',
      capture: {
        fichier: 'remises-et-annulations/validation-gerante',
        legende:
          'Dialogue « Annuler 1 Poulet braisé ? » : Afi M. choisie comme gérante qui valide, le clavier pour son code et le bouton Valider.',
      },
    },
    {
      titre: 'Une remise ou un offert',
      texte:
        'Touchez l’article, puis **Faire une remise** : choisissez **En %** ou **En montant**, le motif, puis **Appliquer**. Pour un article gratuit, touchez **Offrir** : il reste sur la note à 0 F et la cuisine le prépare normalement. Pour toute la note, passez par **Actions sur la note**, puis **Remise sur la note**.',
      capture: {
        fichier: 'remises-et-annulations/remise',
        legende:
          'Dialogue « Remise sur Poulet braisé » : en montant, 500 F, motif Réclamation, bouton Appliquer.',
      },
    },
    {
      titre: 'L’addition demandée',
      texte:
        'Quand le client demande l’addition, touchez **Actions sur la note**, puis **Addition demandée**. Un bandeau l’indique sur la note avec l’heure, et la table remonte dans **À traiter** sur le plan de salle.',
      capture: {
        fichier: 'remises-et-annulations/addition-demandee',
        legende: 'Note de T4, 4 500 F : bandeau « Addition demandée à » l’heure, par Kossi A.',
      },
    },
    {
      titre: 'Changer de table',
      texte:
        'Touchez **Actions sur la note**, puis **Transférer vers une autre table**. Choisissez une table libre et confirmez. Tous les articles suivent la note : rien n’est refait en cuisine.',
      capture: {
        fichier: 'remises-et-annulations/transfert',
        legende:
          'Dialogue « Transférer la note de T4 » : T5 choisie parmi les tables libres, bouton Transférer vers T5.',
      },
    },
    {
      titre: 'Annuler toute la note',
      texte:
        'Si le client part sans consommer, touchez **Actions sur la note**, puis **Annuler la note**. Choisissez le motif et confirmez : les articles envoyés sont annulés, la table redevient libre. Un gérant valide si votre rôle l’exige.',
      capture: {
        fichier: 'remises-et-annulations/annuler-la-note',
        legende:
          'Dialogue « Annuler la note de T5 ? » : motif « Le client est parti », bouton Annuler la note.',
      },
    },
  ],
  bonASavoir: [
    'Chaque annulation, remise et offert est visible dans **Activité**, avec son motif et le nom du gérant qui l’a validé.',
    'Votre plafond de remise s’affiche à côté de **Faire une remise** (« jusqu’à 10 % pour vous ») ; au-delà, un gérant valide.',
    'La validation d’un gérant ne vaut que pour cette action, pendant 60 secondes.',
  ],
  problemes: [
    {
      question: 'Aucun gérant n’apparaît dans le dialogue de validation.',
      reponse:
        'Un gérant doit d’abord avoir choisi son code personnel sur une caisse de l’établissement.',
    },
    {
      question: 'La note ne se modifie plus.',
      reponse:
        'Un paiement a déjà été encaissé dessus : terminez l’encaissement, puis remboursez si besoin depuis **Notes encaissées**.',
    },
  ],
  suivant: 'encaisser',
}
