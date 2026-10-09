import type { Guide } from '../guides'

export const ecranCuisine: Guide = {
  id: 'ecran-cuisine',
  titre: 'L’écran cuisine',
  role: 'cuisine',
  pour: ['Cuisine'],
  objectif:
    'Lire les bons dans l’ordre d’arrivée, dire quand un plat est commencé puis prêt, pour que la salle vienne le chercher.',
  exemple:
    'Kossi envoie deux Poulet braisé depuis la salle. Le bon arrive en cuisine avec un bip. Le cuisinier touche Commencer : côté caisse, la table affiche « En préparation ». Quand les poulets sont prêts, il touche Tout est prêt et la table passe au vert.',
  etapes: [
    {
      titre: 'Lire et commencer un bon',
      texte:
        'Chaque bon porte la table, le serveur et le temps d’attente, les plus anciens d’abord. Touchez **Commencer** quand vous lancez la préparation.',
      capture: {
        fichier: 'ecran-cuisine/bons',
        legende:
          'Onglet À préparer : les bons du plus ancien au plus récent, dont celui de T1 (deux Poulet braisé, Kossi A.).',
      },
    },
    {
      titre: 'Marquer prêt',
      texte:
        'Touchez **Prêt** sur un article, ou **Tout est prêt** pour le bon entier. Le bon passe dans l’onglet **Prêts** et la salle est prévenue.',
      capture: {
        fichier: 'ecran-cuisine/en-preparation',
        legende: 'Bon en préparation avec le bouton Tout est prêt.',
      },
    },
    {
      titre: 'Rappeler un bon',
      texte:
        'Un bon marqué prêt par erreur se rappelle depuis l’onglet **Prêts**, pendant une heure, avec **Rappeler**.',
      capture: {
        fichier: 'ecran-cuisine/prets',
        legende: 'Onglet Prêts : le bon terminé et son bouton Rappeler.',
      },
    },
  ],
  bonASavoir: [
    'L’écran reste allumé tant que les bons sont affichés : inutile de régler la mise en veille de la tablette.',
    'Touchez **Plein écran**, dans la barre du haut, pour masquer le navigateur. Échap ou le geste du système en sort, de même qu’un rechargement après une mise à jour. Le bouton n’existe pas sur iPhone.',
    'Le bip d’un nouveau bon se coupe et se remet avec le bouton de son, en haut de l’écran.',
    'Un article annulé par la salle est barré sur le bon : inutile de le préparer.',
    'Les catégories que la salle sert elle-même (les bières, par exemple) n’arrivent pas en cuisine.',
  ],
  problemes: [
    {
      question: 'Aucun bon n’arrive.',
      reponse:
        'Vérifiez que la catégorie du plat est cochée **Envoyée en cuisine**, dans **Carte**, puis **Gérer les catégories**.',
    },
  ],
}
