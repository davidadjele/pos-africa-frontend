import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DetailCaisse } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { useImpression } from '../../partage/impression/useImpression'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { ContenuRapportZ, LigneMouvement, Montant } from '../encaissement/PartiesRapportZ'
import { formaterJournee } from './periodes'
import { requeteDetailCaisse } from './requetes'

/** Une caisse en détail : son Z figé, ses mouvements d'espèces et ses remboursements. */
export function PageDetailCaisse({ ouvertureId }: Readonly<{ ouvertureId: string }>) {
  const { t } = useTranslation()
  const { moi } = useSession()
  const fuseauHoraire = moi?.entrepriseCourante?.fuseauHoraire ?? 'Africa/Lome'
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const detail = useQuery(requeteDetailCaisse(ouvertureId))
  const { imprimer, zone } = useImpression()
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })

  if (detail.isPending) return <Chargement texte={t('rapports.caisses.chargement')} />
  if (detail.isError) return <AlerteErreur erreur={detail.error} />
  const { caisse, rapportZ } = detail.data
  const titre =
    rapportZ === undefined
      ? t('rapports.detail.titreEnCours', { caisse: caisse.caisse })
      : t('rapports.detail.titre', { numero: rapportZ.numero, caisse: caisse.caisse })
  const sousTitre =
    caisse.clotureeLe === undefined
      ? t('rapports.detail.ouverte', {
          etablissement: caisse.etablissement,
          jour: formaterJournee(caisse.journee),
          heure: formaterHeure(caisse.ouverteLe, fuseauHoraire),
          nom: caisse.ouvertePar,
        })
      : t('rapports.detail.cloturee', {
          etablissement: caisse.etablissement,
          jour: formaterJournee(caisse.journee),
          ouverture: formaterHeure(caisse.ouverteLe, fuseauHoraire),
          nom: caisse.ouvertePar,
          cloture: formaterHeure(caisse.clotureeLe, fuseauHoraire),
          par: caisse.clotureePar ?? '',
        })

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/gestion/caisses"
        className="flex items-center gap-1.5 text-libelle font-bold text-encre"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('rapports.caisses.titre')}
      </Link>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-titre-page text-encre">{titre}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">{sousTitre}</p>
        </div>
        {rapportZ !== undefined && (
          <Bouton
            icone={Printer}
            onClick={() => {
              imprimer(
                <ZImprime
                  detail={detail.data}
                  titre={titre}
                  sousTitre={sousTitre}
                  nombre={nombre}
                />,
              )
            }}
          >
            {t('rapports.detail.imprimer')}
          </Bouton>
        )}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <section
          aria-label={
            rapportZ === undefined ? t('rapports.detail.enCours') : t('rapports.detail.z')
          }
          className="flex flex-col rounded-moyen border border-trait bg-surface px-5 py-4"
        >
          {rapportZ === undefined ? (
            <>
              <span className="self-start">
                <BadgeStatut ton="info">{t('rapports.caisses.enCours')}</BadgeStatut>
              </span>
              <Montant
                libelle={t('rapports.detail.ventesEnCours', {
                  count: detail.data.ventesEnCours?.notes ?? 0,
                })}
                valeur={nombre(detail.data.ventesEnCours?.total ?? 0)}
              />
            </>
          ) : (
            <ContenuRapportZ rapport={rapportZ} nombre={nombre} />
          )}
        </section>
        <div className="flex flex-col gap-4">
          <section
            aria-label={t('rapports.detail.mouvements')}
            className="flex flex-col rounded-moyen border border-trait bg-surface px-4 py-3"
          >
            <h2 className="m-0 text-titre-carte text-encre">{t('rapports.detail.mouvements')}</h2>
            {detail.data.mouvements.length === 0 ? (
              <p className="m-0 py-2 text-corps text-attenue">
                {t('rapports.detail.aucunMouvement')}
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {detail.data.mouvements.map((mouvement) => (
                  <LigneMouvement
                    key={mouvement.id}
                    mouvement={mouvement}
                    devise={devise}
                    fuseauHoraire={fuseauHoraire}
                  />
                ))}
              </ul>
            )}
          </section>
          <section
            aria-label={t('rapports.detail.remboursements')}
            className="flex flex-col rounded-moyen border border-trait bg-surface px-4 py-3"
          >
            <h2 className="m-0 text-titre-carte text-encre">
              {t('rapports.detail.remboursements')}
            </h2>
            {detail.data.remboursements.length === 0 ? (
              <p className="m-0 py-2 text-corps text-attenue">
                {t('rapports.detail.aucunRemboursement')}
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {detail.data.remboursements.map((remboursement) => (
                  <li
                    key={remboursement.operationId}
                    className="flex items-center gap-3 border-b border-trait py-2.5 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-libelle font-bold text-encre">
                        {t('rapports.detail.remboursement', {
                          note: remboursement.note,
                          motif: t(`remboursement.motifs.${remboursement.motif}`),
                        })}
                      </span>
                      <span className="text-legende text-attenue">
                        {t('rapports.detail.parA', {
                          heure: formaterHeure(remboursement.le, fuseauHoraire),
                          nom: remboursement.par,
                        })}
                      </span>
                    </span>
                    <span className="chiffres text-montant-ligne text-encre">{`−${nombre(remboursement.montant)}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Link
            to="/gestion/ventes"
            search={{
              du: caisse.journee,
              au: caisse.journee,
              etablissement: caisse.etablissementId,
            }}
            className="flex min-h-cible-min items-center justify-between rounded-moyen border border-trait bg-surface px-4 text-libelle font-bold text-encre"
          >
            {t('rapports.detail.voirVentes')}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      {zone}
    </div>
  )
}

/** Le Z tel qu'il sort sur le rouleau de la caisse, noir sur blanc. */
function ZImprime({
  detail,
  titre,
  sousTitre,
  nombre,
}: Readonly<{
  detail: DetailCaisse
  titre: string
  sousTitre: string
  nombre: (valeur: number) => string
}>) {
  if (detail.rapportZ === undefined) return null
  return (
    <article className="ticket-80 flex flex-col bg-surface px-3 py-3 text-legende text-encre">
      <span className="text-corps-fort">{titre}</span>
      <span>{sousTitre}</span>
      <ContenuRapportZ rapport={detail.rapportZ} nombre={nombre} />
    </article>
  )
}
