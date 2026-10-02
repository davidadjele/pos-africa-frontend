import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DemandeReglagesRecu,
  EtablissementResume,
  ReglagesRecu,
} from '../../partage/api/contrat'
import { nomPays, telephoneDuPays } from '../../partage/referentiel/pays'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { Case } from '../../partage/ui/Case'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'

/** Comment l'établissement imprime ses reçus : papier, impression d'office, téléphone et messages. */
export function DialogueReglagesRecu({
  etablissement,
  pays,
  surFermer,
  surEnregistre,
}: Readonly<{
  etablissement: EtablissementResume
  /** Pays de l'entreprise : un numéro saisi sans indicatif y est lu. */
  pays: string
  surFermer: () => void
  surEnregistre: () => void
}>) {
  const { t } = useTranslation()
  const reglages = useQuery({
    queryKey: ['etablissements', etablissement.id, 'recu'],
    queryFn: ({ signal }) =>
      appelerApi<ReglagesRecu>(`/etablissements/${etablissement.id}/recu`, { signal }),
  })
  if (reglages.data === undefined) {
    return (
      <Dialogue
        titre={t('recu.reglages.titre', { nom: etablissement.nom })}
        consequence={t('recu.reglages.phrase')}
        libelleConfirmer={t('commun.fermer')}
        surConfirmer={surFermer}
      >
        {reglages.isError ? (
          <AlerteErreur erreur={reglages.error} />
        ) : (
          <Chargement texte={t('recu.reglages.chargement')} />
        )}
      </Dialogue>
    )
  }
  return (
    <Formulaire
      etablissement={etablissement}
      reglages={reglages.data}
      pays={pays}
      surFermer={surFermer}
      surEnregistre={surEnregistre}
    />
  )
}

function Formulaire({
  etablissement,
  reglages,
  pays,
  surFermer,
  surEnregistre,
}: Readonly<{
  etablissement: EtablissementResume
  reglages: ReglagesRecu
  pays: string
  surFermer: () => void
  surEnregistre: () => void
}>) {
  const { t, i18n } = useTranslation()
  const telephonePays = telephoneDuPays(pays)
  const [largeur, setLargeur] = useState(reglages.largeur)
  const [impressionAuto, setImpressionAuto] = useState(reglages.impressionAuto)
  const [telephone, setTelephone] = useState(reglages.telephone ?? '')
  const [enTete, setEnTete] = useState(reglages.enTete ?? '')
  const [pied, setPied] = useState(reglages.pied ?? '')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function enregistrer() {
    setEnCours(true)
    setErreur(null)
    const demande: DemandeReglagesRecu = {
      ...(telephone.trim() === '' ? {} : { telephone: telephone.trim() }),
      ...(enTete.trim() === '' ? {} : { enTete: enTete.trim() }),
      ...(pied.trim() === '' ? {} : { pied: pied.trim() }),
      largeur,
      impressionAuto,
    }
    try {
      await appelerApi(`/etablissements/${etablissement.id}/recu`, {
        methode: 'PUT',
        corps: demande,
      })
      surEnregistre()
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={t('recu.reglages.titre', { nom: etablissement.nom })}
      consequence={t('recu.reglages.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('commun.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void enregistrer()}
    >
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <div
        role="radiogroup"
        aria-label={t('recu.reglages.largeur')}
        className="flex flex-col gap-2"
      >
        <span className="text-libelle font-semibold text-encre">{t('recu.reglages.largeur')}</span>
        <div className="grid grid-cols-2 gap-2">
          {[58, 80].map((candidat) => (
            <button
              key={candidat}
              type="button"
              role="radio"
              aria-checked={largeur === candidat}
              onClick={() => {
                setLargeur(candidat)
              }}
              className={clsx(
                'min-h-cible-min rounded-normal bg-surface text-corps text-encre',
                largeur === candidat ? 'border-2 border-accent font-bold' : 'border border-trait',
              )}
            >
              {t('recu.reglages.mm', { largeur: candidat })}
            </button>
          ))}
        </div>
      </div>
      <Case
        libelle={t('recu.reglages.auto')}
        aide={t('recu.reglages.autoAide')}
        checked={impressionAuto}
        onChange={(evenement) => {
          setImpressionAuto(evenement.target.checked)
        }}
      />
      <ChampSaisie
        libelle={t('recu.reglages.telephone')}
        type="tel"
        maxLength={32}
        prefixe={telephone.trim().startsWith('+') ? undefined : telephonePays?.indicatif}
        placeholder={telephonePays?.exemple}
        aide={t('ardoise.client.telephoneAide', { pays: nomPays(pays, i18n.language) })}
        value={telephone}
        onChange={(evenement) => {
          setTelephone(evenement.target.value)
        }}
      />
      <ChampSaisie
        libelle={t('recu.reglages.enTete')}
        maxLength={500}
        value={enTete}
        onChange={(evenement) => {
          setEnTete(evenement.target.value)
        }}
      />
      <ChampSaisie
        libelle={t('recu.reglages.pied')}
        maxLength={500}
        value={pied}
        onChange={(evenement) => {
          setPied(evenement.target.value)
        }}
      />
    </Dialogue>
  )
}
