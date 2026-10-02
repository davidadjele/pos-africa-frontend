import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { DemandeIdentiteEntreprise, IdentiteEntreprise } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { nomPays, PAYS_PAR_DEFAUT, telephoneDuPays } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'

const requeteEntreprise = {
  queryKey: ['entreprise'],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    appelerApi<IdentiteEntreprise>('/entreprise', { signal }),
}

/** L'identité de l'entreprise, telle que ses reçus l'impriment : numéro fiscal, téléphone, adresse. */
export function PageEntreprise() {
  const { t } = useTranslation()
  const identite = useQuery(requeteEntreprise)

  if (identite.isPending) return <Chargement texte={t('entreprise.chargement')} />
  if (identite.isError) {
    return (
      <AlerteErreur
        erreur={identite.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void identite.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  }
  return <Formulaire identite={identite.data} />
}

function Formulaire({ identite }: Readonly<{ identite: IdentiteEntreprise }>) {
  const { t, i18n } = useTranslation()
  const clientRequetes = useQueryClient()
  const { moi } = useSession()
  const pays = moi?.entrepriseCourante?.pays ?? PAYS_PAR_DEFAUT.pays
  const telephonePays = telephoneDuPays(pays)
  const [saisie, setSaisie] = useState({
    numeroFiscal: identite.numeroFiscal ?? '',
    telephone: identite.telephone ?? '',
    email: identite.email ?? '',
    adresse: identite.adresse ?? '',
  })
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [confirmation, setConfirmation] = useState(false)

  function champ(nom: keyof typeof saisie) {
    return {
      value: saisie[nom],
      onChange: (evenement: { target: { value: string } }) => {
        setSaisie((actuelle) => ({ ...actuelle, [nom]: evenement.target.value }))
        setConfirmation(false)
      },
    }
  }

  async function enregistrer() {
    setEnCours(true)
    setErreur(null)
    const rempli = (valeur: string) => (valeur.trim() === '' ? undefined : valeur.trim())
    const numeroFiscal = rempli(saisie.numeroFiscal)
    const telephone = rempli(saisie.telephone)
    const email = rempli(saisie.email)
    const adresse = rempli(saisie.adresse)
    const demande: DemandeIdentiteEntreprise = {
      ...(numeroFiscal === undefined ? {} : { numeroFiscal }),
      ...(telephone === undefined ? {} : { telephone }),
      ...(email === undefined ? {} : { email }),
      ...(adresse === undefined ? {} : { adresse }),
    }
    try {
      clientRequetes.setQueryData(
        requeteEntreprise.queryKey,
        await appelerApi<IdentiteEntreprise>('/entreprise', { methode: 'PUT', corps: demande }),
      )
      setConfirmation(true)
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="m-0 text-titre-page text-encre">{identite.nom}</h1>
        <p className="m-0 mt-1 text-corps text-attenue">{t('entreprise.phrase')}</p>
      </div>
      {confirmation && <Alerte ton="succes">{t('entreprise.fait')}</Alerte>}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <form
        className="flex flex-col gap-4 rounded-moyen border border-trait bg-surface p-5"
        onSubmit={(evenement) => {
          evenement.preventDefault()
          void enregistrer()
        }}
      >
        <ChampSaisie
          libelle={t('entreprise.numeroFiscal')}
          aide={t('entreprise.numeroFiscalAide')}
          maxLength={50}
          {...champ('numeroFiscal')}
        />
        <ChampSaisie
          libelle={t('entreprise.telephone')}
          type="tel"
          maxLength={32}
          prefixe={saisie.telephone.trim().startsWith('+') ? undefined : telephonePays?.indicatif}
          placeholder={telephonePays?.exemple}
          aide={t('ardoise.client.telephoneAide', { pays: nomPays(pays, i18n.language) })}
          {...champ('telephone')}
        />
        <ChampSaisie
          libelle={t('entreprise.email')}
          type="email"
          maxLength={254}
          {...champ('email')}
        />
        <ChampSaisie libelle={t('entreprise.adresse')} maxLength={255} {...champ('adresse')} />
        <div className="flex justify-end">
          <Bouton variante="principal" type="submit" enCours={enCours}>
            {t('commun.enregistrer')}
          </Bouton>
        </div>
      </form>
    </div>
  )
}
