import type { Guide } from '../guides'

export const stock: Guide = {
  id: 'stock',
  titre: 'Suivre le stock',
  role: 'gestion',
  pour: ['Gérant', 'Propriétaire'],
  objectif:
    'Compter les boissons, enregistrer les livraisons et les pertes, justifier les écarts d’inventaire et voir en caisse ce qui manque.',
  exemple:
    'Afi, gérante à Bè Kpota, compte 12 Flag 65 cl : c’est le premier comptage. Elle réceptionne 24 bouteilles du bon BL 2240 à 650 F l’unité, règle le seuil d’alerte à 40, puis déclare 2 bouteilles cassées. À l’inventaire suivant, elle en compte 33 au lieu de 34 et justifie l’écart. En caisse, la tuile du Flag affiche « 33 restants ».',
  etapes: [
    {
      titre: 'Le premier comptage',
      texte:
        'Dans **Stock**, une boisson jamais comptée porte le badge « À compter ». Touchez **Faire l’inventaire**, saisissez la quantité comptée, puis **Voir les écarts** : Tonti l’indique « Premier comptage », sans écart à justifier. Terminez par **Valider l’inventaire**.',
      capture: {
        fichier: 'stock/a-compter',
        legende: 'Stock de Bè Kpota : Flag 65 cl, pas encore compté, badge À compter.',
      },
    },
    {
      titre: 'Réceptionner une livraison',
      texte:
        'Touchez **Réceptionner une livraison**. Choisissez chaque produit reçu dans **Ajouter un produit**, puis saisissez sa quantité et, si vous l’avez, son coût unitaire : il sert au calcul de la marge dans les rapports. Le numéro du bon de livraison est facultatif. Le bouton d’enregistrement rappelle le nombre de produits et d’unités.',
      capture: {
        fichier: 'stock/reception',
        legende:
          'Réception du bon BL 2240 : 24 Flag 65 cl à 650 F l’unité, bouton Enregistrer : 1 produit, 24 unités.',
      },
    },
    {
      titre: 'Déclarer une perte',
      texte:
        'Une bouteille cassée, périmée ou bue par l’équipe sort du stock sans être vendue. Touchez **Déclarer une perte**, choisissez le produit, la quantité et le motif : **Casse**, **Périmé**, **Consommé par le personnel** ou **Autre**, à préciser. Validez avec le bouton qui indique la quantité retirée.',
      capture: {
        fichier: 'stock/perte',
        legende:
          'Dialogue Déclarer une perte : 2 Flag 65 cl, motif Casse, bouton Retirer 2 du stock.',
      },
    },
    {
      titre: 'Faire l’inventaire',
      texte:
        'Touchez **Faire l’inventaire** et comptez sans regarder le stock enregistré ; un produit laissé vide garde son stock. Touchez **Voir les écarts** : chaque écart demande un motif, choisi dans la liste. **Valider l’inventaire** corrige le stock.',
      capture: {
        fichier: 'stock/inventaire-ecarts',
        legende:
          'Écarts de l’inventaire : Flag 65 cl enregistré 34, compté 33, écart −1, motif Vol.',
      },
    },
    {
      titre: 'L’historique d’un produit',
      texte:
        'Ouvrez le menu d’actions d’un produit, puis **Historique**. Chaque mouvement y figure, du plus récent au plus ancien, avec le stock qui en résulte : comptages, réceptions et leur coût, ventes, retours, pertes et inventaires.',
      capture: {
        fichier: 'stock/historique',
        legende:
          'Historique de Flag 65 cl, 33 en stock : premier comptage, réception BL 2240, perte pour casse, inventaire −1.',
      },
    },
    {
      titre: 'Le stock faible, jusqu’en caisse',
      texte:
        'Dans le menu d’actions d’un produit, touchez **Régler le seuil d’alerte**. Sous ce seuil, le produit passe en « Stock faible » et le menu **Stock** affiche un compteur. En caisse, la tuile montre ce qui reste ; sans stock, elle indique « Plus en stock ».',
      capture: {
        fichier: 'stock/tuile-stock-faible',
        legende: 'En caisse, la tuile Flag 65 cl signale « 33 restants ».',
      },
    },
  ],
  bonASavoir: [
    'Seuls les boissons et articles revendus tels quels sont suivis ; les plats cuisinés ne le sont pas.',
    'La politique de stock, en haut de la page **Stock**, dit ce que fait la caisse sans stock : « Souple » vend quand même, « Avertissement » demande de confirmer avec **Vendre quand même**, « Stricte » refuse. Elle se change avec **Modifier**, dans les réglages de l’établissement.',
    'Les pertes et les écarts d’inventaire sont tracés dans **Activité** comme actions critiques.',
  ],
  problemes: [
    {
      question: 'Le bouton « Valider l’inventaire » reste grisé.',
      reponse:
        'Un écart n’a pas de motif : choisissez-en un pour chaque ligne du tableau des écarts, ou touchez **Recompter**.',
    },
    {
      question: 'Un produit est en « Stock négatif ».',
      reponse:
        'La caisse a vendu plus que le stock enregistré : une livraison n’a sans doute pas été saisie. Réceptionnez-la, ou corrigez par un inventaire.',
    },
  ],
  suivant: 'suivre-les-ventes',
}
