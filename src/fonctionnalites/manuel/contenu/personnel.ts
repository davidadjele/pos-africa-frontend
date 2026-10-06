import type { Guide } from '../guides'

export const personnel: Guide = {
  id: 'personnel',
  titre: 'Personnel, rôles et codes PIN',
  role: 'gestion',
  pour: ['Propriétaire', 'Administrateur', 'Gérant'],
  objectif:
    'Ajouter un employé avec un rôle par établissement, lui remettre ses codes, réinitialiser un PIN oublié et désactiver un départ.',
  exemple:
    'Tanti ajoute Kossi Agbeko, serveur à Bè Kpota, Sena Gbeasor, serveuse dans ses deux maquis, et Afi Mensah, gérante de Bè Kpota avec un accès au back-office. Afi remplace son mot de passe temporaire, puis ne voit que le personnel de Bè Kpota. Elle réinitialise le PIN de Sena, sans pouvoir modifier sa fiche.',
  etapes: [
    {
      titre: 'Ajouter un employé',
      texte:
        'Dans **Réglages**, onglet **Personnel**, touchez **Ajouter un employé**. Saisissez le prénom et le nom, puis choisissez un rôle dans chaque établissement où il travaille : **Gérant**, **Caissier**, **Serveur** ou **Cuisine**. Laissez **Aucun** ailleurs. Terminez par **Enregistrer l’employé**.',
      capture: {
        fichier: 'premier-jour/employe',
        legende:
          'Formulaire « Ajouter un employé » : un rôle par établissement (gérante à Bè Kpota) et l’accès au back-office.',
      },
    },
    {
      titre: 'L’accès au back-office',
      texte:
        'Un gérant ou un administrateur peut aussi gérer depuis un téléphone ou un ordinateur. Cochez **Donner un accès au back-office** et saisissez son téléphone ou son e-mail : ce sera son identifiant. Serveurs, caissiers et cuisine n’utilisent que la caisse.',
      capture: {
        fichier: 'premier-jour/employe',
        legende:
          'Formulaire « Ajouter un employé » : la case Donner un accès au back-office cochée et le téléphone qui servira d’identifiant.',
      },
    },
    {
      titre: 'Remettre les codes',
      texte:
        'Tonti affiche un **PIN de caisse temporaire**, et un **Mot de passe temporaire du back-office** si l’accès est donné. Ils ne s’affichent qu’une fois : notez-les, remettez-les à l’employé, puis touchez **J’ai noté les codes**.',
      capture: {
        fichier: 'personnel/codes',
        legende:
          'Dialogue « Codes d’accès de Afi Mensah » : PIN de caisse temporaire, mot de passe temporaire du back-office et identifiant de connexion.',
      },
    },
    {
      titre: 'La première connexion',
      texte:
        'À sa première connexion au back-office, l’employé saisit le mot de passe temporaire, en choisit un personnel, puis touche **Enregistrer et me reconnecter**. Sur la tablette, il remplace de même son PIN temporaire par un code à lui.',
      capture: {
        fichier: 'personnel/mot-de-passe',
        legende:
          'Écran « Choisissez votre mot de passe » à la première connexion d’Afi : mot de passe temporaire, nouveau mot de passe et confirmation.',
      },
    },
    {
      titre: 'PIN oublié, départ',
      texte:
        'La liste montre l’accès de chacun, et un PIN **À changer** tant que l’employé n’a pas choisi le sien. Touchez **Modifier** pour changer ses rôles. Dans le menu de la ligne, **Réinitialiser le PIN** puis **Générer un nouveau PIN** donne un nouveau PIN temporaire. **Désactiver** coupe ses accès à la caisse et au back-office ; ses ventes restent à son nom.',
      capture: {
        fichier: 'personnel/actions',
        legende:
          'Liste du personnel : Tanti, Kossi, Sena et Afi. Le menu de Kossi Agbeko est ouvert sur Réinitialiser le PIN et Désactiver.',
      },
    },
    {
      titre: 'Ce que voit un gérant',
      texte:
        'Un gérant ne voit que le personnel de ses établissements. Un employé qui travaille aussi ailleurs ne se modifie ni ne se désactive depuis son compte : il peut seulement **Réinitialiser le PIN**, pour le débloquer en plein service.',
      capture: {
        fichier: 'personnel/vue-gerante',
        legende:
          'Vue d’Afi, gérante de Bè Kpota : Sena Gbeasor, serveuse à Bè Kpota, n’a que Réinitialiser le PIN dans son menu.',
      },
    },
  ],
  bonASavoir: [
    'Un employé n’apparaît sur une tablette que s’il a un rôle dans l’établissement de cette tablette.',
    'Une réinitialisation de PIN est tracée dans **Activité**, avec son auteur.',
    'Un employé désactivé se remet en service avec **Réactiver**, sur sa ligne.',
  ],
  problemes: [
    {
      question: 'La case « Donner un accès au back-office » n’apparaît pas.',
      reponse:
        'Aucun des rôles choisis n’ouvre le back-office. Donnez-lui le rôle **Gérant** dans au moins un établissement.',
    },
    {
      question: 'Un employé a perdu son PIN temporaire.',
      reponse:
        'Il n’est plus affiché nulle part : touchez **Réinitialiser le PIN** sur sa ligne et remettez-lui le nouveau.',
    },
  ],
  suivant: 'tablettes',
}
