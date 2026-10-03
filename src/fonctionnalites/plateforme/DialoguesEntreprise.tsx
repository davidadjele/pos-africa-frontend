import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DemandeModificationPlateforme,
  DemandeSuspension,
  FicheEntreprisePlateforme,
  MotDePasseTemporaire,
  RaisonSuspension,
} from '../../partage/api/contrat'
import { optionsDevises, optionsPays } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { CodeSecret } from '../../partage/ui/CodeSecret'
import { Dialogue } from '../../partage/ui/Dialogue'

export const RAISONS: RaisonSuspension[] = ['DEMANDE_CLIENT', 'IMPAYE', 'ABUS', 'AUTRE']

function messageDuChamp(erreur: unknown, champ: string): string | undefined {
  return erreur instanceof ErreurApi
    ? erreur.reponse.champs?.find((invalide) => invalide.champ === champ)?.message
    : undefined
}

/** Le pays et la devise ne se touchent plus après la première vente : le serveur le refuse aussi. */
export function DialogueModifierEntreprise({
  fiche,
  surFermer,
  surEnregistrer,
}: Readonly<{
  fiche: FicheEntreprisePlateforme
  surFermer: () => void
  surEnregistrer: (demande: DemandeModificationPlateforme) => Promise<void>
}>) {
  const { t, i18n } = useTranslation()
  const [nom, setNom] = useState(fiche.nom)
  const [numeroFiscal, setNumeroFiscal] = useState(fiche.numeroFiscal ?? '')
  const [pays, setPays] = useState(fiche.pays)
  const [devise, setDevise] = useState(fiche.devise)
  const [essaye, setEssaye] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const nomManquant = nom.trim() === ''
  const erreursChamps = {
    nom: messageDuChamp(erreur, 'nom'),
    numeroFiscal: messageDuChamp(erreur, 'numeroFiscal'),
    pays: messageDuChamp(erreur, 'pays'),
    devise: messageDuChamp(erreur, 'devise'),
  }
  const sousUnChamp = Object.values(erreursChamps).some((message) => message !== undefined)

  async function enregistrer() {
    setEssaye(true)
    if (nomManquant) return
    setEnCours(true)
    setErreur(null)
    try {
      await surEnregistrer({
        nom: nom.trim(),
        ...(numeroFiscal.trim() === '' ? {} : { numeroFiscal: numeroFiscal.trim() }),
        pays,
        devise,
        version: fiche.version,
      })
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={t('plateforme.fiche.modification.titre', { nom: fiche.nom })}
      consequence={t('plateforme.fiche.modification.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('commun.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void enregistrer()}
    >
      {erreur !== null && !sousUnChamp && <AlerteErreur erreur={erreur} />}
      <ChampSaisie
        libelle={t('plateforme.fiche.modification.nom')}
        obligatoire
        maxLength={150}
        value={nom}
        erreur={
          essaye && nomManquant ? t('plateforme.fiche.modification.nomManquant') : erreursChamps.nom
        }
        onChange={(evenement) => {
          setNom(evenement.target.value)
        }}
      />
      <ChampSaisie
        libelle={t('plateforme.fiche.modification.numeroFiscal')}
        maxLength={50}
        value={numeroFiscal}
        aide={t('plateforme.fiche.modification.numeroFiscalAide')}
        erreur={erreursChamps.numeroFiscal}
        onChange={(evenement) => {
          setNumeroFiscal(evenement.target.value)
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <ChampSelection
          libelle={t('plateforme.fiche.modification.pays')}
          options={optionsPays(i18n.language)}
          value={pays}
          disabled={fiche.aDejaVendu}
          erreur={erreursChamps.pays}
          onChange={(evenement) => {
            setPays(evenement.target.value)
          }}
        />
        <ChampSelection
          libelle={t('plateforme.fiche.modification.devise')}
          options={optionsDevises(i18n.language)}
          value={devise}
          disabled={fiche.aDejaVendu}
          erreur={erreursChamps.devise}
          onChange={(evenement) => {
            setDevise(evenement.target.value)
          }}
        />
      </div>
      {fiche.aDejaVendu && <Alerte ton="alerte">{t('plateforme.fiche.modification.figes')}</Alerte>}
    </Dialogue>
  )
}

/** Une raison toujours, une précision pour « Autre » : le reste de l'équipe doit pouvoir la relire. */
export function DialogueSuspension({
  fiche,
  surFermer,
  surSuspendre,
}: Readonly<{
  fiche: FicheEntreprisePlateforme
  surFermer: () => void
  surSuspendre: (demande: DemandeSuspension) => Promise<void>
}>) {
  const { t } = useTranslation()
  const [raison, setRaison] = useState<RaisonSuspension>('DEMANDE_CLIENT')
  const [precision, setPrecision] = useState('')
  const [essaye, setEssaye] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const precisionManquante = raison === 'AUTRE' && precision.trim() === ''

  async function suspendre() {
    setEssaye(true)
    if (precisionManquante) return
    setEnCours(true)
    setErreur(null)
    try {
      await surSuspendre({
        raison,
        ...(precision.trim() === '' ? {} : { precision: precision.trim() }),
      })
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={t('plateforme.entreprises.suspension.titre', { nom: fiche.nom })}
      consequence={t('plateforme.entreprises.suspension.consequence')}
      libelleAnnuler={t('plateforme.entreprises.suspension.annuler')}
      libelleConfirmer={t('plateforme.entreprises.suspension.confirmer')}
      tonConfirmation="danger"
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void suspendre()}
    >
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <ChampSelection
        libelle={t('plateforme.fiche.suspension.raison')}
        obligatoire
        options={RAISONS.map((valeur) => ({
          valeur,
          libelle: t(`plateforme.fiche.suspension.raisons.${valeur}`),
        }))}
        value={raison}
        onChange={(evenement) => {
          setRaison(evenement.target.value as RaisonSuspension)
        }}
      />
      <ChampSaisie
        libelle={t('plateforme.fiche.suspension.precision')}
        obligatoire={raison === 'AUTRE'}
        maxLength={200}
        value={precision}
        placeholder={t('plateforme.fiche.suspension.precisionExemple')}
        aide={t('plateforme.fiche.suspension.precisionAide')}
        erreur={
          essaye && precisionManquante
            ? t('plateforme.fiche.suspension.precisionManquante')
            : undefined
        }
        onChange={(evenement) => {
          setPrecision(evenement.target.value)
        }}
      />
    </Dialogue>
  )
}

/**
 * Redonner un mot de passe au propriétaire, en deux temps : vérifier qui appelle, puis montrer le mot de passe
 * une seule fois. Il n'est gardé nulle part : fermer la fenêtre l'efface.
 */
export function DialogueMotDePasse({
  entrepriseId,
  proprietaire,
  surFermer,
}: Readonly<{
  entrepriseId: string
  proprietaire: FicheEntreprisePlateforme['proprietaires'][number]
  surFermer: () => void
}>) {
  const { t } = useTranslation()
  const [temporaire, setTemporaire] = useState<MotDePasseTemporaire | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const nom = `${proprietaire.prenom} ${proprietaire.nom}`

  async function generer() {
    setEnCours(true)
    setErreur(null)
    try {
      setTemporaire(
        await appelerApi<MotDePasseTemporaire>(
          `/plateforme/entreprises/${entrepriseId}/proprietaires/${proprietaire.compteId}/mot-de-passe`,
          { methode: 'POST' },
        ),
      )
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  if (temporaire !== null)
    return (
      <Dialogue
        titre={t('plateforme.fiche.motDePasse.secretTitre', { nom })}
        consequence={t('plateforme.fiche.motDePasse.secretPhrase')}
        libelleConfirmer={t('plateforme.fiche.motDePasse.transmis')}
        surConfirmer={surFermer}
      >
        <CodeSecret
          libelle={t('plateforme.fiche.motDePasse.secretLibelle')}
          code={temporaire.motDePasseTemporaire}
        />
        <p className="m-0 text-legende text-attenue">
          {t('personnel.codes.identifiant', { identifiant: temporaire.identifiant })}
        </p>
      </Dialogue>
    )

  return (
    <Dialogue
      titre={t('plateforme.fiche.motDePasse.titre', { nom })}
      consequence={t('plateforme.fiche.motDePasse.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('plateforme.fiche.motDePasse.generer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void generer()}
    >
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <Alerte ton="alerte">
        {t('plateforme.fiche.motDePasse.verifier', {
          contact: proprietaire.telephone ?? proprietaire.email ?? '',
        })}
      </Alerte>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-corps text-encre">
        <li>{t('plateforme.fiche.motDePasse.consequenceSessions')}</li>
        {proprietaire.autresEntreprises.length > 0 && (
          <li>
            {t('plateforme.fiche.motDePasse.consequenceAutres', {
              entreprises: proprietaire.autresEntreprises.join(', '),
            })}
          </li>
        )}
        <li>{t('plateforme.fiche.motDePasse.consequenceTrace')}</li>
      </ul>
    </Dialogue>
  )
}
