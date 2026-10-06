import type { Guide } from '../guides'

export const suivreLesVentes: Guide = {
  id: 'suivre-les-ventes',
  titre: 'Suivre les ventes et les caisses',
  role: 'gestion',
  pour: ['Propriétaire', 'Gérant'],
  objectif:
    'Lire la journée en cours, les ventes d’une période, la marge, les rapports Z de chaque caisse et les actions sensibles de l’équipe.',
  exemple:
    'Le soir, Tanti ouvre le tableau de bord : « Écart à la clôture : −500 F » sur le Z n°1 de Bè Kpota. Dans les ventes des 7 derniers jours, elle lit la marge brute, calculée grâce au Flag 65 cl reçu à 650 F. Elle ouvre ensuite le Z n°1 de la « Caisse 2, terrasse » : l’écart est expliqué « Monnaie rendue en trop ». L’activité lui montre quelles annulations Afi a validées.',
  etapes: [
    {
      titre: 'Le tableau de bord',
      texte:
        'Le **Tableau de bord** montre ce qui est vendu aujourd’hui, comparé au même jour de la semaine dernière à la même heure, puis ce qui se passe dans chaque établissement : caisses et notes ouvertes. Sous « À traiter », chaque point mène à l’écran concerné : écart à la clôture, stock négatif ou faible, note ouverte depuis longtemps, ardoises à relancer.',
      capture: {
        fichier: 'suivre-les-ventes/tableau-de-bord',
        legende:
          'Tableau de bord : vendu aujourd’hui, Bè Kpota en ce moment avec la caisse ouverte d’Afi M., et sous À traiter l’écart de −500 F à la clôture du Z n°1.',
      },
    },
    {
      titre: 'Les ventes d’une période',
      texte:
        'Dans **Ventes**, onglet **Rapports**, choisissez la période : **Aujourd’hui**, **Hier**, **7 derniers jours**, **Ce mois**, **Mois dernier** ou **Choisir les dates**. Tonti affiche le chiffre d’affaires comparé à la période d’avant, le panier moyen, les remises et les remboursements. **Par jour** et **Par heure** changent le graphique. L’encadré « À surveiller » relève les remboursements, les annulations après envoi, les remises en hausse et les ventes sur l’ardoise.',
      capture: {
        fichier: 'suivre-les-ventes/ventes',
        legende:
          'Ventes des 7 derniers jours : chiffre d’affaires, marge brute, graphique par jour et encadré À surveiller (remboursements, ventes sur l’ardoise).',
      },
    },
    {
      titre: 'Par produit, par catégorie',
      texte:
        'Le tableau « Par produit » classe ce qui s’est vendu ; **Catégories** le regroupe par famille de la carte. Dès qu’un coût d’achat est connu, saisi à la réception d’une livraison, les colonnes Coût, Marge et Taux apparaissent, selon vos droits. **Exporter (CSV)** télécharge les ventes par jour et par produit, prêtes pour un tableur.',
      capture: {
        fichier: 'suivre-les-ventes/categories',
        legende:
          'Chiffre d’affaires par heure, et tableau Par produit regroupé par catégorie : quantités, montants, coût et marge.',
      },
    },
    {
      titre: 'Les caisses',
      texte:
        'Dans **Ventes**, onglet **Caisses**, chaque ouverture de caisse a sa ligne : son rapport Z, qui l’a clôturée, ses ventes et son écart. Une caisse encore ouverte porte le badge « En cours ». Cochez **Seulement les écarts** pour ne garder que les caisses à expliquer.',
      capture: {
        fichier: 'suivre-les-ventes/caisses',
        legende:
          'Caisses de la période : le Z n°1 avec un écart de −500 F, et la caisse rouverte, En cours.',
      },
    },
    {
      titre: 'Le rapport Z',
      texte:
        'Touchez **Voir** sur une ligne. Le rapport Z reprend les ventes par mode de paiement, l’écart et l’explication saisie à la clôture, les mouvements de caisse et les remboursements. **Imprimer le Z** l’imprime pour vos archives.',
      capture: {
        fichier: 'suivre-les-ventes/detail-z',
        legende:
          'Rapport Z n°1 de la Caisse 2, terrasse : écart de −500 F expliqué « Monnaie rendue en trop », retrait de 10 000 F et remboursement.',
      },
    },
    {
      titre: 'L’activité',
      texte:
        'Dans **Activité**, retrouvez qui a fait quoi : annulations et remises avec leur motif et qui les a validées, mouvements et clôtures de caisse, pertes de stock, prix modifiés, ardoises. **Critiques seulement** est choisi d’office ; touchez **Tout** pour le reste. Filtrez par **Période** ou par **Domaine**.',
      capture: {
        fichier: 'suivre-les-ventes/activite',
        legende:
          'Activité, critiques seulement : caisse clôturée et rouverte avec un écart, retrait d’espèces, dépassement de plafond d’ardoise, annulations et remise validées par Afi M.',
      },
    },
  ],
  bonASavoir: [
    'Les ventes se comptent par journée de caisse : une note payée après minuit compte pour la veille.',
    'Les écarts de caisse se suivent au tableau de bord et dans **Caisses**, pas dans les ventes.',
    'L’historique des prix d’un produit s’ouvre dans **Carte**, onglet **Produits**, depuis le menu d’actions du produit : **Historique des prix**.',
  ],
  problemes: [
    {
      question: 'Les colonnes de marge n’apparaissent pas.',
      reponse:
        'Aucun coût d’achat n’est connu sur la période : saisissez le coût unitaire en réceptionnant les livraisons, dans **Stock**.',
    },
    {
      question: 'L’onglet « Caisses » n’apparaît pas.',
      reponse:
        'Il est réservé aux comptes qui ont accès aux rapports financiers, comme celui du propriétaire.',
    },
  ],
}
