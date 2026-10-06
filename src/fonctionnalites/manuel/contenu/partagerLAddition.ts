import type { Guide } from '../guides'

export const partagerLAddition: Guide = {
  id: 'partager-l-addition',
  titre: 'Partager l’addition',
  role: 'caisse',
  pour: ['Caissier', 'Gérant'],
  objectif:
    'Faire payer chaque client sa part d’une même note : par articles, en parts égales ou en montants libres.',
  exemple:
    'En T6, trois clients ont pris chacun un Poulet braisé : 13 500 F. Le premier paie son poulet par carte. Les deux autres se partagent le reste, 4 500 F chacun : l’un par carte, l’autre en Mobile Money. Au dernier paiement, la note est soldée et T6 redevient libre.',
  etapes: [
    {
      titre: 'Ouvrir l’encaissement',
      texte:
        'Ouvrez la note, puis touchez **Encaisser**. En haut de l’écran, choisissez comment partager : **Montant libre**, **Parts égales** ou **Par articles**.',
    },
    {
      titre: 'Chacun paie ce qu’il a pris',
      texte:
        'Touchez **Par articles**, puis **+** sur chaque article que paie ce client. La « Sélection » donne le montant, remises comprises. Choisissez le mode de paiement et validez. Recommencez pour le client suivant, ou touchez **Tout le reste**.',
      capture: {
        fichier: 'partager-l-addition/par-articles',
        legende:
          'Note de T6, 13 500 F, partage par articles : un Poulet braisé sélectionné, 4 500 F, par carte, bouton Valider 4 500 F en carte.',
      },
    },
    {
      titre: 'Le même montant pour chacun',
      texte:
        'Touchez **Parts égales** et réglez le **Nombre de parts** avec **−** et **+** : il part du nombre de couverts. Chaque part est un paiement, avec son propre mode. Un reste d’arrondi va sur la dernière part.',
      capture: {
        fichier: 'partager-l-addition/parts-egales',
        legende:
          'Parts égales sur le reste de T6 : Part 1 en cours, 4 500 F, et Part 2 à payer, 4 500 F.',
      },
    },
    {
      titre: 'Solder la note',
      texte:
        'La note se clôt avec le dernier paiement. Le reçu reprend chaque paiement : imprimez-le ou envoyez-le par WhatsApp, comme pour un encaissement simple.',
    },
  ],
  bonASavoir: [
    'Les modes se mélangent librement : une part en carte, l’autre en espèces ou en Mobile Money.',
    'Un article entièrement payé est marqué « Payé » : il ne peut plus être choisi.',
    'Pour un paiement mixte sans partage (une partie en Mobile Money, le reste en espèces), restez sur **Montant libre**.',
  ],
  problemes: [
    {
      question: 'Je ne peux plus réduire le nombre de parts.',
      reponse:
        'Des parts sont déjà payées : il en faut au moins une de plus que celles déjà encaissées.',
    },
  ],
  suivant: 'ardoise',
}
