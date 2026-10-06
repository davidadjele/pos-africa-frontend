import type { Guide } from '../guides'

export const laCarte: Guide = {
  id: 'la-carte',
  titre: 'La carte : produits, prix et taxes',
  role: 'gestion',
  pour: ['Propriétaire', 'Administrateur', 'Gérant'],
  objectif:
    'Composer la carte commune, fixer un prix propre à un établissement et déclarer un produit épuisé pour la journée.',
  exemple:
    'Tanti crée la Flag 65 cl à 1 000 F TTC, dont 153 F de TVA, puis passe son prix à 1 100 F. À Bè Kpota, elle la vend 1 200 F. Le soir, Afi, la gérante, la déclare épuisée depuis son téléphone : elle revient en vente le lendemain à 4 h.',
  etapes: [
    {
      titre: 'Les taxes',
      texte:
        'Dans **Carte**, onglet **Taxes**, vérifiez les taux. **Ajouter une taxe** en crée une autre. Un nouveau taux vaut pour les ventes suivantes ; les ventes passées gardent le leur.',
      capture: {
        fichier: 'premier-jour/taxes',
        legende: 'Liste des taxes de l’entreprise : TVA à 18 %.',
      },
    },
    {
      titre: 'La fiche produit',
      texte:
        'Dans l’onglet **Produits**, touchez **Ajouter un produit**. Choisissez la **Catégorie**, le **Type** (**Plat**, **Boisson** ou **Article**), puis saisissez le **Prix TTC**, celui que paie le client. Choisissez la **Taxe** : Tonti affiche la part de taxe comprise. Pour un plat dont le stock n’est pas suivi, le **Coût de revient** calcule la marge.',
      capture: {
        fichier: 'premier-jour/produit',
        legende:
          'Fiche produit « Flag 65 cl », catégorie Bières, type Boisson, 1 000 F TTC dont 153 F de TVA, stock suivi.',
      },
    },
    {
      titre: 'Changer un prix',
      texte:
        'Touchez **Modifier** sur la ligne du produit, changez le **Prix TTC**, puis **Enregistrer les modifications**. Les ventes déjà faites gardent leur prix. Dans le menu de la ligne, **Historique des prix** montre chaque changement, sa date et son auteur.',
      capture: {
        fichier: 'la-carte/historique-prix',
        legende:
          'Historique des prix de « Flag 65 cl » : le prix de base passé à 1 100 F sur toute la carte, et le prix de 1 200 F à Bè Kpota.',
      },
    },
    {
      titre: 'Un prix par établissement',
      texte:
        'Dans l’onglet **Par établissement**, choisissez l’établissement. Dans le menu du produit, touchez **Prix dans cet établissement**, saisissez le prix, puis **Enregistrer le prix**. **Revenir au prix de base** le supprime.',
      capture: {
        fichier: 'la-carte/prix-etablissement',
        legende:
          'Dialogue « Prix de « Flag 65 cl » à Bè Kpota » : prix de base de la carte 1 100 F, prix TTC à Bè Kpota 1 200 F.',
      },
    },
    {
      titre: 'La carte d’un établissement',
      texte:
        'La liste montre le prix de base, le prix appliqué ici et la disponibilité de chaque produit. **Ne plus proposer ici**, dans le menu, retire un produit des caisses de cet établissement ; **Proposer ici** l’y remet.',
      capture: {
        fichier: 'la-carte/carte-etablissement',
        legende:
          'Carte de Bè Kpota : Flag 65 cl, prix de base 1 100 F, 1 200 F ici avec le badge Prix propre, disponible.',
      },
    },
    {
      titre: 'Épuisé pour la journée',
      texte:
        'Quand un produit manque, touchez **Épuisé ce jour** sur sa ligne : la caisse ne le propose plus. Il revient seul en vente le lendemain à 4 h, ou plus tôt avec **Remettre en vente**. Un gérant le fait aussi depuis son téléphone.',
      capture: {
        fichier: 'la-carte/epuise',
        legende:
          'Carte de Bè Kpota : la ligne Flag 65 cl, avec son prix propre et le bouton Épuisé ce jour.',
      },
    },
  ],
  bonASavoir: [
    'Seul un propriétaire ou un administrateur crée les produits et change les prix ; un gérant déclare les ruptures.',
    'Un produit vendu ne se supprime pas : touchez **Désactiver** dans son menu, il disparaît de la caisse.',
    'Si le prix de base change, un établissement qui a un prix propre le garde.',
  ],
  problemes: [
    {
      question: 'Le champ Prix TTC est grisé.',
      reponse:
        'Votre rôle ne permet pas de changer les prix : demandez-le au propriétaire ou à un administrateur.',
    },
    {
      question: 'Une taxe refuse de se désactiver.',
      reponse:
        'Elle s’applique encore à des produits actifs : changez d’abord leur **Taxe** dans leur fiche.',
    },
  ],
  suivant: 'options-et-variantes',
}
