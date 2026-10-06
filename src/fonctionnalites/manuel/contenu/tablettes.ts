import type { Guide } from '../guides'

export const tablettes: Guide = {
  id: 'tablettes',
  titre: 'Tablettes de caisse et écran cuisine',
  role: 'gestion',
  pour: ['Propriétaire', 'Gérant'],
  objectif:
    'Faire d’une tablette une caisse ou un écran cuisine avec un code à six chiffres, puis la suivre et la révoquer si elle est perdue.',
  exemple:
    'Tanti enregistre la tablette du bar de Bè Kpota sous le nom « Caisse 1, bar ». Elle génère un code, le tape sur la tablette, et Kossi peut y prendre la caisse. Plus tard, elle enregistre la tablette de la cuisine comme écran cuisine, puis révoque « Caisse 1, bar » : la tablette revient aussitôt à l’écran d’enregistrement.',
  etapes: [
    {
      titre: 'Générer un code',
      texte:
        'Dans **Réglages**, onglet **Tablettes**, touchez **Enregistrer une tablette**. Choisissez l’**Établissement**, l’**Usage** (**Caisse** ou **Écran cuisine**) et le **Nom de la caisse**, tel que le personnel le verra. Touchez **Générer le code** : il est valable 10 minutes.',
      capture: {
        fichier: 'premier-jour/tablette',
        legende: 'Code d’enregistrement à six chiffres pour la tablette « Caisse 1, bar ».',
      },
    },
    {
      titre: 'Taper le code sur la tablette',
      texte:
        'Sur la tablette, ouvrez Tonti : l’écran **Enregistrer cette tablette** s’affiche. Tapez les six chiffres, le code se valide seul. Votre mot de passe n’y est jamais saisi. Sur votre écran, Tonti confirme l’enregistrement : touchez **Terminer**.',
      capture: {
        fichier: 'tablettes/saisie-code',
        legende:
          'Écran « Enregistrer cette tablette » sur la tablette : les trois étapes et le clavier pour taper le code.',
      },
    },
    {
      titre: 'L’écran cuisine',
      texte:
        'Pour la tablette de la cuisine, choisissez l’usage **Écran cuisine** avant de générer le code. Elle affiche les bons envoyés en cuisine, sans PIN. Un seul écran cuisine par établissement.',
      capture: {
        fichier: 'tablettes/ecran-cuisine',
        legende:
          'Code d’enregistrement généré pour la tablette « Cuisine », avec le temps de validité restant.',
      },
    },
    {
      titre: 'Suivre les tablettes',
      texte:
        'La liste montre l’usage, l’établissement, la dernière activité et le statut de chaque tablette. **Modifier** change son nom ou son usage : la tablette en tient compte à son prochain chargement.',
      capture: {
        fichier: 'tablettes/liste',
        legende:
          'Tablettes de l’entreprise : « Caisse 1, bar », caisse de Bè Kpota, statut Active, avec Modifier et le menu d’actions.',
      },
    },
    {
      titre: 'Révoquer une tablette',
      texte:
        'Une tablette perdue, volée ou remplacée se révoque : dans le menu de sa ligne, touchez **Révoquer**, puis **Révoquer la tablette**. Elle est coupée aussitôt. Pour la réutiliser, enregistrez-la de nouveau avec un code.',
      capture: {
        fichier: 'tablettes/revoquer',
        legende:
          'Dialogue « Révoquer « Caisse 1, bar » ? » : la tablette sera coupée aussitôt ; boutons Garder la tablette et Révoquer la tablette.',
      },
    },
  ],
  bonASavoir: [
    'Une caisse s’ouvre avec le PIN de chaque employé ; seuls ceux qui ont un rôle dans son établissement y apparaissent.',
    'Un code non utilisé s’annule avec **Annuler ce code**.',
    'Chaque révocation est tracée dans **Activité**, avec son auteur.',
  ],
  problemes: [
    {
      question: 'Le code ne marche plus.',
      reponse:
        'Il a expiré au bout de 10 minutes. Touchez **Générer un nouveau code** et tapez-le aussitôt.',
    },
    {
      question: 'La tablette affiche de nouveau l’écran d’enregistrement.',
      reponse:
        'Elle a été révoquée. Générez un nouveau code depuis **Tablettes** pour l’enregistrer de nouveau.',
    },
  ],
  suivant: 'la-carte',
}
