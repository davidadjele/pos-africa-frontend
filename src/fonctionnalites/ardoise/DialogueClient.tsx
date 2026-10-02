import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type { DemandeClient } from '../../partage/api/contrat'
import { symboleDe, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { nomPays, telephoneDuPays } from '../../partage/referentiel/pays'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Dialogue } from '../../partage/ui/Dialogue'

export interface ClientSaisi {
  nom: string
  telephone?: string | undefined
  plafond?: number | undefined
  note?: string | undefined
}

/**
 * Ouvrir une ardoise, ou modifier un client : depuis la gestion comme depuis la caisse. Le téléphone, unique dans
 * l'établissement, évite deux ardoises pour la même personne.
 */
export function DialogueClient({
  client,
  devise,
  pays,
  avecNote = true,
  surFermer,
  surEnregistrer,
}: Readonly<{
  client?: ClientSaisi
  devise: Devise
  /** Pays de l'entreprise : un numéro saisi sans indicatif y est lu. */
  pays: string
  /** La note interne ne se saisit qu'en gestion, loin du regard du client. */
  avecNote?: boolean
  surFermer: () => void
  surEnregistrer: (demande: DemandeClient) => Promise<void>
}>) {
  const { t, i18n } = useTranslation()
  const telephonePays = telephoneDuPays(pays)
  const [nom, setNom] = useState(client?.nom ?? '')
  const [telephone, setTelephone] = useState(client?.telephone ?? '')
  const [plafond, setPlafond] = useState(
    client?.plafond === undefined ? '' : String(client.plafond),
  )
  const [note, setNote] = useState(client?.note ?? '')
  const [essaye, setEssaye] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const plafondLu = plafond.trim() === '' ? undefined : lireMontant(plafond, devise)
  const manques = { nom: nom.trim() === '', plafond: plafondLu === null }
  const erreurTelephone =
    erreur instanceof ErreurApi
      ? erreur.reponse.champs?.find((champ) => champ.champ === 'telephone')?.message
      : undefined

  async function enregistrer() {
    setEssaye(true)
    if (manques.nom || plafondLu === null) return
    setEnCours(true)
    setErreur(null)
    try {
      await surEnregistrer({
        nom: nom.trim(),
        ...(telephone.trim() === '' ? {} : { telephone: telephone.trim() }),
        ...(plafondLu === undefined ? {} : { plafond: plafondLu }),
        ...(note.trim() === '' ? {} : { note: note.trim() }),
      })
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={client === undefined ? t('ardoise.client.nouveau') : t('ardoise.client.modifier')}
      consequence={t('ardoise.client.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={client === undefined ? t('ardoise.client.ouvrir') : t('commun.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void enregistrer()}
    >
      {erreur !== null && erreurTelephone === undefined && <AlerteErreur erreur={erreur} />}
      <ChampSaisie
        libelle={t('ardoise.client.nom')}
        obligatoire
        maxLength={80}
        value={nom}
        erreur={essaye && manques.nom ? t('ardoise.client.nomManquant') : undefined}
        onChange={(evenement) => {
          setNom(evenement.target.value)
        }}
      />
      <ChampSaisie
        libelle={t('ardoise.client.telephone')}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        maxLength={32}
        prefixe={telephone.trim().startsWith('+') ? undefined : telephonePays?.indicatif}
        placeholder={telephonePays?.exemple}
        value={telephone}
        aide={t('ardoise.client.telephoneAide', { pays: nomPays(pays, i18n.language) })}
        erreur={erreurTelephone}
        onChange={(evenement) => {
          setTelephone(evenement.target.value)
        }}
      />
      <ChampSaisie
        libelle={t('ardoise.client.plafond')}
        inputMode="numeric"
        suffixe={symboleDe(devise)}
        value={plafond}
        aide={t('ardoise.client.plafondAide')}
        erreur={essaye && manques.plafond ? t('ardoise.client.plafondInvalide') : undefined}
        onChange={(evenement) => {
          setPlafond(evenement.target.value)
        }}
      />
      {avecNote && (
        <ChampSaisie
          libelle={t('ardoise.client.note')}
          maxLength={200}
          value={note}
          aide={t('ardoise.client.noteAide')}
          onChange={(evenement) => {
            setNote(evenement.target.value)
          }}
        />
      )}
    </Dialogue>
  )
}
