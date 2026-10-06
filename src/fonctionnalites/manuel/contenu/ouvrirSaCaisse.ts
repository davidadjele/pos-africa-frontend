import type { Guide } from '../guides'

export const ouvrirSaCaisse: Guide = {
  id: 'ouvrir-sa-caisse',
  titre: 'Ouvrir sa caisse',
  role: 'caisse',
  pour: ['Serveur', 'Caissier', 'Gérant'],
  objectif:
    'Prendre la caisse à son nom avec son PIN, choisir son code personnel la première fois et passer la main à un collègue.',
  exemple:
    'Kossi arrive à Bè Kpota pour son premier service. Sur la tablette « Caisse 1, bar », il touche son nom, tape le PIN temporaire donné par Tanti, puis choisit son propre code, tapé deux fois. La caisse s’ouvre à son nom : « Kossi A., Serveur » dans la barre du haut.',
  etapes: [
    {
      titre: 'Toucher son nom',
      texte:
        'Sur l’écran **Qui prend la caisse ?**, touchez votre nom. Seules les personnes qui ont un rôle dans l’établissement de la tablette y figurent.',
      capture: {
        fichier: 'premier-jour/qui-prend-la-caisse',
        legende: 'Écran « Qui prend la caisse ? » avec les noms de l’équipe de Bè Kpota.',
      },
    },
    {
      titre: 'Taper son PIN',
      texte:
        'Tapez votre code sur le clavier, puis **Ouvrir la caisse**. Si vous vous êtes trompé de nom, touchez **Choisir un autre profil**.',
      capture: {
        fichier: 'ouvrir-sa-caisse/pin',
        legende:
          'Profil de Kossi A., serveur : le code temporaire est tapé, bouton Ouvrir la caisse.',
      },
    },
    {
      titre: 'Choisir son code, la première fois',
      texte:
        'Le PIN donné par votre gérant est temporaire. Tonti demande **Choisissez votre code personnel** : tapez 4 à 6 chiffres, **Continuer**, retapez-le, puis **Enregistrer mon code**. Les codes trop simples (1111, 1234) sont refusés.',
      capture: {
        fichier: 'ouvrir-sa-caisse/nouveau-code',
        legende:
          'Écran « Choisissez votre code personnel », étape 2. Confirmation : le code est retapé, bouton Enregistrer mon code.',
      },
    },
    {
      titre: 'La caisse est à votre nom',
      texte:
        'Votre nom et votre rôle s’affichent dans la barre du haut : chaque commande et chaque encaissement est enregistré à votre nom. Pour passer la main, touchez **Changer d’utilisateur** : la tablette revient à **Qui prend la caisse ?**.',
      capture: {
        fichier: 'ouvrir-sa-caisse/caisse-ouverte',
        legende:
          'Caisse ouverte au nom de Kossi A., serveur, avec le bouton Changer d’utilisateur dans la barre du haut.',
      },
    },
    {
      titre: 'Le verrouillage automatique',
      texte:
        'Sans toucher l’écran pendant quelques minutes, la caisse se verrouille seule et revient à **Qui prend la caisse ?**. Le délai est rappelé en bas de cet écran. Retapez votre code : la tablette reprend là où elle était, sur la même note.',
    },
  ],
  bonASavoir: [
    'Votre code signe vos commandes et vos encaissements : ne le donnez à personne.',
    'Le délai de verrouillage se règle par établissement, dans **Réglages**, onglet **Établissements**, champ **Verrouillage de la caisse**.',
    'Un serveur prend les commandes ; un caissier ou un gérant encaisse. Le même écran sert à tous.',
  ],
  problemes: [
    {
      question: 'Mon nom n’apparaît pas sur la tablette.',
      reponse:
        'Vous n’avez pas de rôle dans l’établissement de cette tablette : demandez à un gérant de vous l’ajouter dans **Personnel**.',
    },
    {
      question: 'Mon profil affiche « Bloqué ».',
      reponse:
        'Cinq codes erronés ont été tapés. Un gérant ouvre la gestion, **Personnel**, puis **Réinitialiser le PIN** : il vous remet un nouveau code temporaire, et vous choisissez ensuite le vôtre.',
    },
  ],
  suivant: 'prendre-une-commande',
}
