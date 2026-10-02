import { Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type { EnvoiRecu, RecuCaisse } from '../../partage/api/contrat'
import { messageDuChamp } from '../../partage/formulaires/erreursServeur'
import { telephoneDuPays } from '../../partage/referentiel/pays'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { lienRecu, lienWhatsApp } from '../recu/liens'

/**
 * Le lien du reçu, envoyé par le WhatsApp de la tablette : le serveur lit le numéro (avec ou sans indicatif), le
 * caissier n'a plus qu'à appuyer sur « Envoyer » dans WhatsApp. Le numéro n'est pas enregistré.
 */
export function EnvoiWhatsApp({
  commandeId,
  recu,
  pays,
  telephoneClient,
  surEnvoye,
}: Readonly<{
  commandeId: string
  recu: RecuCaisse
  pays: string
  /** Note mise sur l'ardoise : le numéro du client, proposé d'office. */
  telephoneClient?: string | undefined
  surEnvoye: () => void
}>) {
  const { t } = useTranslation()
  const telephonePays = telephoneDuPays(pays)
  const [telephone, setTelephone] = useState(() =>
    sansIndicatif(telephoneClient ?? '', telephonePays?.indicatif),
  )
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [ouvert, setOuvert] = useState(false)
  const erreurTelephone = messageDuChamp(erreur, 'telephone')

  async function envoyer() {
    setEnCours(true)
    setErreur(null)
    setOuvert(false)
    try {
      const envoi = await appelerCaisse<EnvoiRecu>(`/caisse/commandes/${commandeId}/recu/envois`, {
        methode: 'POST',
        corps: { telephone: telephone.trim() },
      })
      const message = t('recu.whatsapp.message', {
        numero: recu.numero,
        entreprise: recu.entreprise,
        lien: lienRecu(recu.jeton),
      })
      globalThis.open(lienWhatsApp(envoi.telephone, message), '_blank', 'noopener')
      setOuvert(true)
      surEnvoye()
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form
      onSubmit={(evenement) => {
        evenement.preventDefault()
        void envoyer()
      }}
      className="w-full border-t border-trait pt-3 text-left"
    >
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-libelle font-semibold text-encre">
          {t('recu.whatsapp.titre')}
        </legend>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-48 flex-1">
            <ChampSaisie
              libelle={t('recu.whatsapp.numero')}
              libelleMasque
              type="tel"
              inputMode="tel"
              autoComplete="off"
              maxLength={30}
              prefixe={telephone.trim().startsWith('+') ? undefined : telephonePays?.indicatif}
              placeholder={telephonePays?.exemple}
              value={telephone}
              erreur={erreurTelephone}
              onChange={(evenement) => {
                setTelephone(evenement.target.value)
              }}
            />
          </div>
          <Bouton
            type="submit"
            icone={Send}
            className="w-full sm:w-auto"
            enCours={enCours}
            disabled={telephone.trim() === ''}
          >
            {t('recu.whatsapp.envoyer')}
          </Bouton>
        </div>
        {erreur !== null && erreurTelephone === undefined && <AlerteErreur erreur={erreur} />}
        {ouvert ? (
          <output aria-label={t('recu.whatsapp.statut')} className="text-legende text-succes">
            {t('recu.whatsapp.ouvert')}
          </output>
        ) : (
          <p className="m-0 text-legende text-attenue">{t('recu.whatsapp.aide')}</p>
        )}
      </fieldset>
    </form>
  )
}

/** « +22890123456 » au Togo s'écrit « 90123456 » derrière l'indicatif affiché. */
function sansIndicatif(telephone: string, indicatif: string | undefined): string {
  return indicatif !== undefined && telephone.startsWith(indicatif)
    ? telephone.slice(indicatif.length)
    : telephone
}
