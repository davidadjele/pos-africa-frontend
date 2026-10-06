import type { Guide } from '../guides'

export const prendreUneCommande: Guide = {
  id: 'prendre-une-commande',
  titre: 'Prendre une commande',
  role: 'caisse',
  pour: ['Serveur', 'Caissier', 'Gérant'],
  objectif:
    'Ouvrir une note sur une table, ajouter les plats et leurs options, l’envoyer en cuisine et servir quand c’est prêt.',
  exemple:
    'Trois clients s’installent en T4, sur la terrasse. Kossi ouvre une note pour 3 couverts, ajoute deux Poulet braisé « sans piment », puis les envoie en préparation. Quand la cuisine les marque prêts, la table passe au vert sur son plan de salle.',
  etapes: [
    {
      titre: 'Ouvrir une note',
      texte:
        'Sur le plan de salle, touchez une table libre. Indiquez le nombre de couverts avec **+** et **−**, puis **Ouvrir la note**. Pour un client sans table, touchez **Vente au comptoir**.',
      capture: {
        fichier: 'prendre-une-commande/ouvrir',
        legende: 'Dialogue « Ouvrir une note sur T4 » avec 3 couverts.',
      },
    },
    {
      titre: 'Ajouter les produits',
      texte:
        'Touchez une catégorie, puis la tuile du produit : chaque toucher en ajoute un. Pour une consigne (« sans piment »), touchez l’article sur la note, puis **Consigne pour la préparation** : elle vaut pour toute la ligne.',
      capture: {
        fichier: 'prendre-une-commande/ajouter',
        legende: 'Note de T4 : deux Poulet braisé « sans piment », 9 000 FCFA, à envoyer.',
      },
    },
    {
      titre: 'Variantes et options',
      texte:
        'Un produit à variantes (« 2 pièces », « 4 pièces ») fait d’abord choisir la variante. Si le produit a des options, choisissez-les : une option obligatoire doit l’être avant **Ajouter**. Le prix affiché comprend les suppléments.',
      capture: {
        fichier: 'prendre-une-commande/options',
        legende:
          'Côtelettes d’agneau, 4 pièces : cuisson À point et supplément Œuf, bouton Ajouter à 9 200 F.',
      },
    },
    {
      titre: 'Envoyer en préparation',
      texte:
        'Touchez **Envoyer en préparation**. Les plats partent sur l’écran cuisine ; les boissons d’une catégorie qui n’y va pas sont simplement validées. Un article envoyé ne s’annule plus qu’avec l’accord d’un gérant.',
      capture: {
        fichier: 'prendre-une-commande/envoyer',
        legende: 'Bouton « Envoyer 2 articles en préparation » en bas de la note.',
      },
    },
    {
      titre: 'Servir ce qui est prêt',
      texte:
        'Sur le plan de salle, une table en préparation l’indique, puis passe au vert quand la cuisine a fini. La liste **À servir** rappelle ce qui attend : touchez-la pour ouvrir la note.',
      capture: {
        fichier: 'prendre-une-commande/servir',
        legende: 'Plan de salle : une table verte avec « 2 prêts à servir » et la liste À servir.',
      },
    },
  ],
  bonASavoir: [
    'Le ruban **Notes ouvertes**, en bas de l’écran, ramène à toute note en un toucher.',
    'Une note se transfère vers une autre table depuis **Actions sur la note**.',
    'Un produit épuisé est grisé : il ne peut pas être ajouté.',
  ],
  problemes: [
    {
      question: 'Le bouton Encaisser est grisé.',
      reponse:
        'Un serveur prend les commandes, un caissier ou un gérant encaisse : touchez **Changer d’utilisateur** pour lui passer la main.',
    },
    {
      question: 'Un article envoyé doit être retiré.',
      reponse:
        'Touchez-le, puis **Annuler** : choisissez la raison, et un gérant valide avec son code.',
    },
  ],
  suivant: 'remises-et-annulations',
}
