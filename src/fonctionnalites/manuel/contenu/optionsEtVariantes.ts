import type { Guide } from '../guides'

export const optionsEtVariantes: Guide = {
  id: 'options-et-variantes',
  titre: 'Options et variantes',
  role: 'gestion',
  pour: ['Propriétaire', 'Administrateur'],
  objectif:
    'Proposer en caisse la cuisson, les accompagnements ou les suppléments d’un plat, et vendre un même plat en plusieurs tailles.',
  exemple:
    'Tanti ajoute les Côtelettes d’agneau à la carte. Elle crée deux groupes : la cuisson (Saignant ou À point), obligatoire, et les suppléments (Œuf à 200 F, Piment inclus), deux au plus. Elle les attache aux côtelettes, vendues en 2 pièces à 5 000 F ou 4 pièces à 9 000 F.',
  etapes: [
    {
      titre: 'Créer un groupe d’options',
      texte:
        'Dans **Carte**, onglet **Options**, touchez **Nouveau groupe**. Donnez le **Nom du groupe**, puis choisissez **Un seul choix** ou **Plusieurs choix**, avec un maximum si besoin. Activez **Obligatoire** si la caisse doit exiger un choix. Saisissez chaque choix et son **Prix en plus**, vide s’il est inclus, puis **Créer le groupe**.',
      capture: {
        fichier: 'options-et-variantes/groupe',
        legende:
          'Dialogue « Nouveau groupe d’options » : Suppléments, plusieurs choix jusqu’à 2, Œuf à 200 F en plus et Piment inclus.',
      },
    },
    {
      titre: 'Stock et coût d’un choix',
      texte:
        'Sous un choix, touchez **Lier au stock**. **Décompter le stock de** fait sortir un produit du stock à chaque vente avec ce choix, et compte son coût dans la marge. Sans produit lié, saisissez un **Coût d’achat**. Le coût ne se voit jamais en caisse.',
    },
    {
      titre: 'Les groupes de la carte',
      texte:
        'La liste résume la règle de chaque groupe, ses choix liés au stock et le nombre de produits qui l’utilisent. Un groupe se définit une fois et sert à plusieurs produits.',
      capture: {
        fichier: 'options-et-variantes/groupes',
        legende:
          'Groupes d’options : Cuisson, choix unique, obligatoire ; Suppléments, choix multiple, 2 au plus.',
      },
    },
    {
      titre: 'Attacher les options à un produit',
      texte:
        'Dans **Produits**, touchez **Modifier** sur le produit. Dans la section **Options**, choisissez un groupe sous **Ajouter un groupe**. Les flèches règlent l’ordre dans lequel la caisse les propose.',
      capture: {
        fichier: 'options-et-variantes/fiche-options',
        legende: 'Fiche des Côtelettes d’agneau, section Options : Cuisson, puis Suppléments.',
      },
    },
    {
      titre: 'Les variantes',
      texte:
        'Sur la même fiche, section **Variantes**, saisissez la **Nouvelle variante** et son **Prix de la variante**, puis **Ajouter la variante**. Chaque variante a son prix, son coût et son stock.',
      capture: {
        fichier: 'options-et-variantes/variantes',
        legende: 'Variantes des Côtelettes d’agneau : 2 pièces à 5 000 F, 4 pièces à 9 000 F.',
      },
    },
    {
      titre: 'En caisse',
      texte:
        'Un produit à variantes affiche « dès » devant son prix sur sa tuile. Le serveur choisit d’abord la variante, puis les options : voir le guide **Prendre une commande**.',
      capture: {
        fichier: 'options-et-variantes/caisse',
        legende:
          'En caisse, le choix de la variante des Côtelettes d’agneau : 2 pièces à 5 000 F ou 4 pièces à 9 000 F.',
      },
    },
  ],
  bonASavoir: [
    'Les notes déjà prises gardent les choix et les prix du moment, même si le groupe change ensuite.',
    'Une variante se modifie depuis la fiche de son produit.',
    'Un groupe attaché à un produit ne se supprime pas : retirez-le d’abord de sa fiche.',
  ],
  problemes: [
    {
      question: 'La caisse refuse d’ajouter le plat.',
      reponse:
        'Un groupe est **Obligatoire** : le serveur doit choisir une option avant de toucher **Ajouter**.',
    },
    {
      question: 'Les sections Options et Variantes n’apparaissent pas.',
      reponse:
        'Elles ne sont visibles qu’une fois le produit enregistré : rouvrez sa fiche avec **Modifier**.',
    },
  ],
  suivant: 'salles-et-tables',
}
