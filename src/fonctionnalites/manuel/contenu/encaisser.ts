import type { Guide } from '../guides'

export const encaisser: Guide = {
  id: 'encaisser',
  titre: 'Encaisser une note',
  role: 'caisse',
  pour: ['Caissier', 'Gérant'],
  objectif:
    'Encaisser en espèces, Mobile Money, carte ou sur l’ardoise d’un client, en un ou plusieurs paiements, puis remettre le reçu.',
  exemple:
    'Au comptoir, la note n°3 : un Poulet braisé, 4 500 F CFA. Le client paie 2 000 F par Flooz, puis le reste en espèces avec un billet de 5 000 F. Afi encaisse les deux paiements, rend 2 500 F et imprime le reçu.',
  etapes: [
    {
      titre: 'Ouvrir l’encaissement',
      texte:
        'Ouvrez la note depuis le plan de salle ou le ruban **Notes ouvertes**, puis touchez **Encaisser**, en bas de la note.',
      capture: {
        fichier: 'encaisser/note',
        legende: 'Note n°3 au comptoir, un Poulet braisé à 4 500 FCFA, bouton Encaisser.',
      },
    },
    {
      titre: 'Compter le fond de caisse',
      texte:
        'Au premier encaissement, Tonti demande les espèces du tiroir : saisissez le nombre de billets et de pièces de chaque valeur, puis **Ouvrir la caisse**. Ce fond sert de départ au comptage du soir.',
      capture: {
        fichier: 'encaisser/fond-de-caisse',
        legende: 'Comptage du fond, billet par billet : 20 000 F d’espèces comptées.',
      },
    },
    {
      titre: 'Un paiement en Mobile Money',
      texte:
        'Choisissez **Mobile Money**, puis l’opérateur. Saisissez le montant payé et la référence de la transaction lue sur le téléphone du client, puis validez. La note affiche ce qui reste à payer.',
      capture: {
        fichier: 'encaisser/mobile-money',
        legende: 'Mobile Money, Flooz : 2 000 F, référence 7F3K29.',
      },
    },
    {
      titre: 'Le reste en espèces',
      texte:
        'Choisissez **Espèces** et saisissez ce que le client donne, ici **5 000**. Tonti affiche la monnaie à rendre, puis validez.',
      capture: {
        fichier: 'encaisser/especes',
        legende: 'Espèces reçues 5 000 F, monnaie à rendre 2 500 F.',
      },
    },
    {
      titre: 'Le reçu',
      texte:
        'La note est encaissée et son reçu numéroté. Touchez **Imprimer le reçu**, ou saisissez le numéro du client sous **Envoyer par WhatsApp** : il reçoit un lien vers son reçu en ligne.',
      capture: {
        fichier: 'encaisser/recu',
        legende: 'Note n°3 encaissée, aperçu du reçu numéroté et bouton Imprimer le reçu.',
      },
    },
  ],
  bonASavoir: [
    'Une note payée appartient à la journée où elle est encaissée, pas à celle où elle a été ouverte.',
    'Le reçu se réimprime depuis **Notes encaissées**, sur la tablette.',
    'L’addition se partage depuis **Encaisser** : par articles ou en parts égales.',
  ],
  problemes: [
    {
      question: 'Tonti refuse le montant en espèces.',
      reponse: 'Les espèces reçues doivent couvrir au moins le reste à payer.',
    },
    {
      question: 'Le client rapporte un plat après l’encaissement.',
      reponse:
        'Remboursez-le depuis **Notes encaissées** : Tonti rend l’argent selon les modes de paiement de la note et imprime un avoir.',
    },
  ],
  suivant: 'partager-l-addition',
}
