import type { Guide } from '../guides'

export const rembourser: Guide = {
  id: 'rembourser',
  titre: 'Rembourser une note',
  role: 'caisse',
  pour: ['Caissier', 'Gérant'],
  objectif:
    'Rendre tout ou partie d’une note déjà encaissée, dans les modes où elle a été payée, et remettre un avoir au client.',
  exemple:
    'Un des Poulet braisé de T6 n’était pas bon. Afi, la gérante, retrouve la note dans les notes encaissées, choisit un poulet, motif « Article non conforme ». Tonti rend les 4 500 F sur la carte qui les a payés et numérote l’avoir, qu’Afi imprime pour le client.',
  etapes: [
    {
      titre: 'Retrouver la note',
      texte:
        'Sur le plan de salle, touchez **Caisse**, puis l’onglet **Notes encaissées**. Touchez la note : son détail s’affiche, avec ses paiements. Le champ de recherche filtre par numéro de note, table ou client.',
      capture: {
        fichier: 'rembourser/notes-encaissees',
        legende:
          'Onglet Notes encaissées : la note de T6 choisie, ses paiements par carte et Mobile Money, boutons Réimprimer le reçu et Rembourser.',
      },
    },
    {
      titre: 'Choisir ce qui est rendu',
      texte:
        'Touchez **Rembourser**. Choisissez les articles avec **+**, ou **Toute la note**, puis le **Motif**. Tonti répartit le montant entre les modes de la note : l’ardoise d’abord, puis la carte et le Mobile Money, les espèces en dernier.',
      capture: {
        fichier: 'rembourser/rembourser',
        legende:
          'Rembourser la note de T6 : un Poulet braisé, 4 500 F à rembourser, rendus en carte, motif Article non conforme.',
      },
    },
    {
      titre: 'Valider le remboursement',
      texte:
        'Touchez le bouton du montant, ici **Rembourser 4 500 F en carte**. Pour un retour en Mobile Money, saisissez d’abord l’opérateur et la référence du transfert. Si votre rôle l’exige, un gérant valide avec son code.',
    },
    {
      titre: 'Remettre l’avoir',
      texte:
        'Le remboursement fait, Tonti affiche le numéro de l’avoir. Touchez **Imprimer l’avoir** et remettez-le au client avec l’argent, puis **Retour aux notes**. Si le client n’en veut pas, touchez **Sans avoir**.',
      capture: {
        fichier: 'rembourser/avoir',
        legende:
          'Remboursement fait : 4 500 F rendus au client, avoir numéroté BE-AV, bouton Imprimer l’avoir.',
      },
    },
    {
      titre: 'La note remboursée',
      texte:
        'La note garde la trace du remboursement : mode, motif et numéro de l’avoir. L’avoir se réimprime depuis ce détail. Le reçu en ligne du client mentionne aussi le remboursement.',
      capture: {
        fichier: 'rembourser/note-remboursee',
        legende:
          'Détail de la note de T6 : un Poulet braisé remboursé en carte, motif article non conforme, avec son avoir.',
      },
    },
  ],
  bonASavoir: [
    'Une note d’un autre jour se retrouve sous **Une note d’un autre jour ?** : saisissez le **Numéro du reçu**, puis **Retrouver**. Jusqu’à 30 jours, avec l’accord d’un gérant ou du propriétaire.',
    'L’argent rendu sort de la caisse du jour et compte dans son rapport Z, même pour une note d’un autre jour.',
    'Chaque remboursement est tracé dans **Activité**, avec son motif.',
  ],
  problemes: [
    {
      question: 'Le bouton Rembourser n’apparaît pas.',
      reponse:
        'Tous les articles ont déjà été remboursés, ou la note a été encaissée il y a plus de 30 jours : elle ne se rembourse plus.',
    },
    {
      question: 'Le numéro du reçu est introuvable.',
      reponse:
        'Seuls les reçus de cet établissement se retrouvent ici : vérifiez le numéro imprimé sur le reçu du client.',
    },
  ],
  suivant: 'cloturer-la-caisse',
}
