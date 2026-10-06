import type { Guide } from '../guides'

export const ardoise: Guide = {
  id: 'ardoise',
  titre: 'L’ardoise des clients',
  role: 'caisse',
  pour: ['Caissier', 'Gérant'],
  objectif:
    'Laisser un client de confiance payer plus tard, dans la limite de son plafond, puis encaisser son règlement et suivre ce qui reste dû.',
  exemple:
    'Tanti ouvre une ardoise à Komlan D., un habitué de Bè Kpota, avec un plafond de 1 000 F. Au comptoir, il prend un Flag 65 cl à 1 200 F : Afi le met sur son ardoise et confirme le dépassement de 200 F. Komlan revient régler avec un billet de 2 000 F ; Afi encaisse 1 200 F en espèces, rend 800 F, et l’ardoise est soldée.',
  etapes: [
    {
      titre: 'Ouvrir une ardoise',
      texte:
        'Dans **Ventes**, onglet **Ardoises**, touchez **Nouveau client**. Saisissez le **Nom**, le **Téléphone** et, si vous le souhaitez, un **Plafond** : ce qu’il peut devoir au plus, vide pour aucun. La **Note interne** n’est jamais montrée au client. Terminez par **Ouvrir l’ardoise**.',
      capture: {
        fichier: 'ardoise/nouveau-client',
        legende:
          'Dialogue Nouveau client : Komlan D., 90 12 34 56, plafond 1 000, note interne « Paie chaque fin de mois. ».',
      },
    },
    {
      titre: 'Mettre une note sur l’ardoise',
      texte:
        'Sur la note, touchez **Encaisser**, puis le mode **Ardoise**. Choisissez le client dans la liste, ou cherchez-le par nom ou téléphone. Tonti affiche ce qu’il doit déjà, cette note et ce qu’il devra après. Si la note dépasse son plafond, Tonti le signale : confirmez le dépassement, qui sera visible du propriétaire, ou faites payer une partie maintenant.',
      capture: {
        fichier: 'ardoise/encaisser',
        legende:
          'Encaissement sur l’ardoise de Komlan D. : 1 200 F sur un plafond de 1 000 F, alerte « Plafond dépassé de 200 F » et bouton Dépasser le plafond.',
      },
    },
    {
      titre: 'Suivre les ardoises',
      texte:
        'Dans **Ventes**, onglet **Ardoises**, le résumé donne le total à recevoir et les clients à relancer, qui doivent depuis plus de 30 jours. Les filtres **Doivent**, **À relancer** et **Tous les clients** trient la liste ; la recherche accepte un nom ou un téléphone.',
      capture: {
        fichier: 'ardoise/ardoises',
        legende:
          'Ardoises de Bè Kpota : 1 200 F à recevoir, Komlan D. doit 1 200 F sur un plafond de 1 000 F.',
      },
    },
    {
      titre: 'La fiche du client',
      texte:
        'Touchez le nom d’un client : sa fiche montre ce qu’il doit, son plafond, sa plus ancienne dette et chaque mouvement, vente à crédit ou règlement. **Modifier** change son plafond ou ses coordonnées ; **Fermer l’ardoise** l’empêche d’en ajouter.',
      capture: {
        fichier: 'ardoise/fiche-client',
        legende:
          'Fiche de Komlan D., +22890123456, Bè Kpota : doit 1 200 F sur un plafond de 1 000 F, mouvement Vente à crédit.',
      },
    },
    {
      titre: 'Encaisser un règlement',
      texte:
        'Sur la tablette, touchez **Caisse**, puis l’onglet **Ardoises**, et choisissez le client parmi ceux qui doivent. Choisissez le mode, **Espèces**, **Mobile Money** ou **Carte**, et le montant réglé ; le bouton « Tout » reprend ce qu’il doit. En espèces, saisissez les **Espèces reçues** : Tonti affiche la monnaie à rendre. Validez avec le bouton d’encaissement.',
      capture: {
        fichier: 'ardoise/reglement',
        legende:
          'Règlement de Komlan D. : 1 200 F en espèces, 2 000 F reçus, monnaie à rendre 800 F.',
      },
    },
  ],
  bonASavoir: [
    'Sans le droit de vendre à crédit, mettre une note sur l’ardoise demande l’accord d’un gérant, avec son code.',
    'Les règlements d’ardoise apparaissent dans la situation de la caisse et sur le rapport Z.',
    'Le tableau de bord signale les ardoises à relancer, avec le montant dû depuis plus de 30 jours.',
  ],
  problemes: [
    {
      question: 'Une note a été mise sur la mauvaise ardoise.',
      reponse:
        'Chaque mouvement est définitif. Remboursez la note depuis **Notes encaissées** : le remboursement diminue ce que doit le client.',
    },
    {
      question: 'Tonti refuse de fermer une ardoise.',
      reponse:
        'Le client doit encore de l’argent : l’ardoise reste ouverte tant qu’elle n’est pas soldée.',
    },
    {
      question: 'Le client n’apparaît pas à la caisse.',
      reponse:
        'La caisse ne montre que les ardoises ouvertes dans son établissement. Si celle du client a été fermée, rouvrez-la depuis sa fiche, avec **Rouvrir l’ardoise**.',
    },
  ],
  suivant: 'rembourser',
}
