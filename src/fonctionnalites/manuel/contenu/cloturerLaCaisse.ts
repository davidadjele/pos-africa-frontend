import type { Guide } from '../guides'

export const cloturerLaCaisse: Guide = {
  id: 'cloturer-la-caisse',
  titre: 'Clôturer la caisse',
  role: 'caisse',
  pour: ['Caissier', 'Gérant'],
  objectif:
    'Suivre les espèces du tiroir pendant le service, compter la caisse à l’aveugle le soir, expliquer un écart et obtenir le rapport Z.',
  exemple:
    'Fin de service à Bè Kpota, sur la « Caisse 2, terrasse ». Afi sort 10 000 F vers le coffre : il reste 13 700 F attendus. Elle compte le tiroir sans voir l’attendu et trouve 13 200 F. Il manque 500 F : elle note « Monnaie rendue en trop » et clôture. Le rapport Z n°1 s’affiche.',
  etapes: [
    {
      titre: 'Un mouvement de caisse',
      texte:
        'Des espèces entrent ou sortent sans vente ? Touchez **Caisse**, puis **Mouvement de caisse**. Choisissez **Retrait**, **Dépense** ou **Apport**, saisissez le **Montant** et le **Motif**, puis validez. Le mouvement compte dans l’attendu de la clôture.',
      capture: {
        fichier: 'cloturer-la-caisse/mouvement',
        legende:
          'Dialogue « Mouvement de caisse » : retrait de 10 000 F, motif « Vers le coffre », bouton Sortir 10 000 F du tiroir.',
      },
    },
    {
      titre: 'L’écran de la caisse',
      texte:
        'L’onglet **Situation** résume la caisse de la tablette : ventes par mode de paiement, remboursements, mouvements et notes encore ouvertes. Le gérant y voit aussi les espèces attendues dans le tiroir.',
      capture: {
        fichier: 'cloturer-la-caisse/caisse',
        legende:
          'Caisse « Caisse 2, terrasse » : 3 notes encaissées, ventes nettes 14 700 F, retrait vers le coffre, espèces attendues 13 700 F.',
      },
    },
    {
      titre: 'Compter à l’aveugle',
      texte:
        'Touchez **Clôturer la caisse**. Comptez tout le tiroir, fond compris : saisissez le nombre de billets et de pièces de chaque valeur, ou touchez **+**. L’attendu reste caché tant que le comptage n’est pas validé. Touchez **Valider le comptage**.',
      capture: {
        fichier: 'cloturer-la-caisse/comptage',
        legende:
          'Comptage de clôture, billet par billet : 13 200 F d’espèces comptées, bouton Valider le comptage.',
      },
    },
    {
      titre: 'Expliquer l’écart',
      texte:
        'Tonti compare au montant attendu. En cas de manque ou d’excédent, saisissez l’**Explication de l’écart** : sans elle, la clôture est impossible. Vérifiez le **Fond laissé pour la prochaine ouverture**, puis **Clôturer la caisse**. Un doute ? Touchez **Recompter**.',
      capture: {
        fichier: 'cloturer-la-caisse/ecart',
        legende:
          'Écart de clôture : manque de 500 F, expliqué par « Monnaie rendue en trop », bouton Clôturer la caisse.',
      },
    },
    {
      titre: 'Le rapport Z',
      texte:
        'Le rapport Z s’affiche : ventes par mode, remboursements, remises, espèces attendues et comptées, écart. Il est figé et ne changera plus. Touchez **Terminer**.',
      capture: {
        fichier: 'premier-jour/rapport-z',
        legende:
          'Rapport Z n°1 de la caisse clôturée : ventes par mode de paiement, remboursements et ventes nettes.',
      },
    },
    {
      titre: 'Rouvrir la caisse',
      texte:
        'Au service suivant, touchez **Caisse** ou **Encaisser** : comptez de nouveau le tiroir, puis **Valider le comptage**. Tonti compare au fond laissé à la clôture ; un écart s’explique avant d’ouvrir la caisse.',
      capture: {
        fichier: 'cloturer-la-caisse/reouverture',
        legende:
          'Réouverture : comptage à l’aveugle, 15 000 F comptés, bouton Valider le comptage.',
      },
    },
  ],
  bonASavoir: [
    'Les notes non encaissées restent ouvertes après la clôture : encaissées sur la caisse suivante, elles comptent dans sa journée.',
    'Chaque Z se retrouve dans la gestion, **Ventes**, onglet **Caisses** : il s’y imprime avec **Imprimer le Z**.',
    'Les mouvements, les écarts et leurs explications sont tracés dans **Activité**.',
  ],
  problemes: [
    {
      question: 'Le bouton Clôturer la caisse reste grisé.',
      reponse: 'Le comptage montre un écart : saisissez son explication.',
    },
    {
      question: 'Je ne vois pas les espèces attendues.',
      reponse:
        'Leur détail est réservé au gérant : à la clôture, on compte le tiroir avant de voir l’attendu.',
    },
  ],
}
