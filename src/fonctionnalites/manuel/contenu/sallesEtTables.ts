import type { Guide } from '../guides'

export const sallesEtTables: Guide = {
  id: 'salles-et-tables',
  titre: 'Salles et tables',
  role: 'gestion',
  pour: ['Propriétaire', 'Gérant'],
  objectif:
    'Décrire le plan de salle de chaque établissement : ses salles, dans l’ordre des onglets de la caisse, et leurs tables.',
  exemple:
    'Afi, gérante de Bè Kpota, crée la Terrasse et le Bar. Elle ajoute huit tables à la Terrasse en une fois, T1 à T8, de 4 places chacune, puis passe T7, la grande table du fond, à 8 places.',
  etapes: [
    {
      titre: 'Créer les salles',
      texte:
        'Dans **Réglages**, onglet **Salles et tables**, choisissez l’établissement si vous en gérez plusieurs. Touchez **Nouvelle salle**, saisissez son nom, puis **Créer la salle**. Chaque salle devient un onglet de la caisse.',
    },
    {
      titre: 'Ajouter des tables en lot',
      texte:
        'Ouvrez l’onglet de la salle, puis touchez **Ajouter des tables**. Indiquez le **Nombre**, le **Premier nom** et les **Places** : Tonti affiche les noms qu’il va créer. Validez, ici avec **Ajouter 8 tables**.',
      capture: {
        fichier: 'premier-jour/tables',
        legende: 'Ajout de 8 tables à la Terrasse : T1 à T8.',
      },
    },
    {
      titre: 'Ajuster une table',
      texte:
        'Dans le menu d’une table, touchez **Modifier** pour changer son nom, ses **Places** ou sa **Salle**, puis **Enregistrer**. Une table servie ne se supprime pas : **Désactiver** la retire de la caisse.',
      capture: {
        fichier: 'salles-et-tables/plan',
        legende:
          'Salles et tables de Bè Kpota, onglet Terrasse : T1 à T8, dont T7 à 8 places, à côté de l’onglet Bar.',
      },
    },
    {
      titre: 'L’ordre des onglets',
      texte:
        'Les salles s’affichent sur la caisse dans l’ordre de cette page. Dans le menu de la salle, **Monter** ou **Descendre** la déplace. **Renommer « Terrasse »** change le nom de la salle ouverte.',
    },
  ],
  bonASavoir: [
    'Le nom d’une table est unique dans l’établissement : deux salles ne peuvent pas avoir chacune leur T1.',
    'Une salle se désactive une fois ses tables déplacées ou désactivées.',
    'Les tables d’une salle se réordonnent aussi, avec **Monter** et **Descendre** dans leur menu.',
  ],
  problemes: [
    {
      question: 'Tonti refuse les noms des nouvelles tables.',
      reponse:
        'Certains existent déjà dans l’établissement. Changez le **Premier nom**, Tonti en propose un libre.',
    },
  ],
  suivant: 'stock',
}
