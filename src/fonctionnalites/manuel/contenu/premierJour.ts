import type { Guide } from '../guides'

export const premierJour: Guide = {
  id: 'premier-jour',
  titre: 'Premier jour : prêt à vendre',
  role: 'gestion',
  pour: ['Propriétaire', 'Gérant'],
  objectif:
    'Mettre en place un établissement, de la carte à la première clôture, dans l’ordre où Tonti en a besoin.',
  exemple:
    'Tanti ouvre le Maquis Chez Tanti à Bè Kpota. Elle saisit la TVA à 18 %, deux catégories (Grillades et Bières), le Poulet braisé et la Flag 65 cl, une terrasse de huit tables, puis ajoute Kossi (serveur) et Afi (gérante). La tablette du bar est enregistrée : Kossi peut prendre sa première commande.',
  etapes: [
    {
      titre: 'Vos établissements',
      texte:
        'Dans **Réglages**, onglet **Établissements**, vérifiez celui créé avec votre compte. Pour un autre lieu de vente, touchez **Ajouter un établissement**, saisissez un code court, le nom et la ville, puis **Créer l’établissement**.',
      capture: {
        fichier: 'premier-jour/etablissement',
        legende: 'Formulaire « Nouvel établissement » : code AG, nom Agbalépédo, ville Lomé.',
      },
    },
    {
      titre: 'Les taxes',
      texte:
        'Dans **Carte**, onglet **Taxes**, vérifiez les taux appliqués. La TVA saisie à la création de l’entreprise y est déjà. Un produit sans taxe n’en porte aucune sur le reçu.',
      capture: {
        fichier: 'premier-jour/taxes',
        legende: 'Liste des taxes de l’entreprise : TVA à 18 %.',
      },
    },
    {
      titre: 'Les catégories',
      texte:
        'Dans **Carte**, onglet **Produits**, touchez **Gérer les catégories**. Créez-en une par famille de la carte, avec sa couleur. Décochez **Envoyée en cuisine** pour ce qui se sert au bar, comme les bières. Les flèches règlent l’ordre des tuiles en caisse.',
      capture: {
        fichier: 'premier-jour/categories',
        legende:
          'Dialogue « Catégories de la carte » : Bières (pas en cuisine) puis Grillades, chacune avec sa couleur.',
      },
    },
    {
      titre: 'Les produits',
      texte:
        'Touchez **Ajouter un produit** : nom, catégorie, type et **Prix TTC**, celui que paie le client. Tonti affiche la TVA comprise. Une boisson est suivie en stock d’office. Terminez par **Enregistrer le produit**.',
      capture: {
        fichier: 'premier-jour/produit',
        legende:
          'Fiche produit « Flag 65 cl », catégorie Bières, type Boisson, 1 000 F TTC dont 153 F de TVA, stock suivi.',
      },
    },
    {
      titre: 'Les salles et les tables',
      texte:
        'Dans **Réglages**, onglet **Salles et tables**, créez chaque salle avec **Nouvelle salle**. Touchez ensuite **Ajouter des tables** : saisissez un nombre, Tonti les numérote (T1, T2…).',
      capture: {
        fichier: 'premier-jour/tables',
        legende: 'Ajout de 8 tables à la Terrasse : T1 à T8.',
      },
    },
    {
      titre: 'Votre équipe',
      texte:
        'Dans **Réglages**, onglet **Personnel**, touchez **Ajouter un employé** et donnez-lui un rôle par établissement. Un gérant peut aussi recevoir un accès au back-office. Après **Enregistrer l’employé**, Tonti affiche un PIN temporaire une seule fois : notez-le et remettez-le à l’employé.',
      capture: {
        fichier: 'premier-jour/employe',
        legende:
          'Formulaire « Ajouter un employé » : un rôle par établissement (gérante à Bè Kpota) et l’accès au back-office.',
      },
    },
    {
      titre: 'La tablette de caisse',
      texte:
        'Dans **Réglages**, onglet **Tablettes**, touchez **Enregistrer une tablette**, choisissez l’établissement, nommez la caisse, puis **Générer le code**. Sur la tablette, ouvrez Tonti et saisissez ce code : elle devient une caisse, sans mot de passe.',
      capture: {
        fichier: 'premier-jour/tablette',
        legende: 'Code d’enregistrement à six chiffres pour la tablette « Caisse 1, bar ».',
      },
    },
    {
      titre: 'Prendre la caisse',
      texte:
        'Sur la tablette, chacun touche son nom sous **Qui prend la caisse ?** et tape son PIN. La première fois, Tonti demande de choisir un code personnel, tapé deux fois.',
      capture: {
        fichier: 'premier-jour/qui-prend-la-caisse',
        legende: 'Écran « Qui prend la caisse ? » avec les noms de l’équipe de Bè Kpota.',
      },
    },
    {
      titre: 'La première vente',
      texte:
        'Suivez le guide **Prendre une commande**, puis **Encaisser une note**. Le premier encaissement de la journée demande de compter le fond de caisse.',
    },
    {
      titre: 'La clôture du soir',
      texte:
        'Sur la tablette, touchez **Caisse**, puis **Clôturer la caisse**. Comptez les espèces sans voir le montant attendu, puis **Valider le comptage**. En cas d’écart, expliquez-le : le rapport Z s’affiche, et s’imprime depuis **Ventes**, onglet **Caisses**.',
      capture: {
        fichier: 'premier-jour/rapport-z',
        legende:
          'Rapport Z n°1 de la caisse clôturée : ventes par mode de paiement, remboursements et ventes nettes.',
      },
    },
  ],
  bonASavoir: [
    'Un gérant ne voit et ne règle que ses établissements ; le propriétaire voit toute l’entreprise.',
    'Les prix, taxes et rôles modifiés sont tracés dans **Activité** : qui, quand, avant et après.',
    'Un prix propre à un établissement se règle dans **Carte**, onglet **Par établissement**.',
  ],
  problemes: [
    {
      question: 'Un employé ne voit pas son nom sur la tablette.',
      reponse:
        'Il n’a pas de rôle dans l’établissement de cette tablette : ajoutez-le depuis sa fiche, dans **Personnel**.',
    },
    {
      question: 'Le code de la tablette ne marche plus.',
      reponse: 'Il se tape dans les 10 minutes : générez-en un nouveau.',
    },
  ],
  suivant: 'prendre-une-commande',
}
