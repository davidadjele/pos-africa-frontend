import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type {
  DemandeModificationPlateforme,
  DemandeSuspension,
  FicheEntreprisePlateforme,
} from '../../partage/api/contrat'
import { formaterDate, formaterDateHeure } from '../../partage/dates/formaterDate'
import { nomPays } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { DialogueModifierEntreprise, DialogueSuspension } from './DialoguesEntreprise'
import { FUSEAU_APPAREIL, requeteFicheEntreprise } from './requetes'

type Ouvert = 'modification' | 'suspension' | 'reactivation' | null
type Etablissement = FicheEntreprisePlateforme['etablissements'][number]

/**
 * La fiche d'une entreprise cliente, vue par l'équipe plateforme : de quoi l'administrer et la dépanner. Aucun
 * montant de vente : seulement des compteurs et des dates.
 */
export function PageFicheEntreprise({ entrepriseId }: Readonly<{ entrepriseId: string }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const requete = requeteFicheEntreprise(entrepriseId)
  const fiche = useQuery(requete)
  const [ouvert, setOuvert] = useState<Ouvert>(null)
  const [message, setMessage] = useState<{ ton: 'succes' | 'alerte'; texte: string } | null>(null)
  const [erreurReactivation, setErreurReactivation] = useState<unknown>(null)
  const [enCours, setEnCours] = useState(false)

  if (fiche.isPending) return <Chargement texte={t('plateforme.fiche.chargement')} />
  if (fiche.isError)
    return (
      <AlerteErreur
        erreur={fiche.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void fiche.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  const donnees = fiche.data

  function fermer(texte: string) {
    setOuvert(null)
    setMessage({ ton: 'succes', texte })
    void clientRequetes.invalidateQueries({ queryKey: ['plateforme', 'entreprises'] })
  }

  async function modifier(demande: DemandeModificationPlateforme) {
    try {
      const nouvelle = await appelerApi<FicheEntreprisePlateforme>(
        `/plateforme/entreprises/${entrepriseId}`,
        { methode: 'PUT', corps: demande },
      )
      clientRequetes.setQueryData(requete.queryKey, nouvelle)
      fermer(t('plateforme.fiche.modification.faite'))
    } catch (refus) {
      if (refus instanceof ErreurApi && refus.code === 'CONFLIT_MODIFICATION') {
        // Rien n'est écrasé : la fiche à jour remplace la saisie, à refaire en connaissance de cause.
        await clientRequetes.refetchQueries({ queryKey: requete.queryKey })
        setOuvert(null)
        setMessage({ ton: 'alerte', texte: t('plateforme.fiche.conflit') })
        return
      }
      throw refus
    }
  }

  async function suspendre(demande: DemandeSuspension) {
    await appelerApi(`/plateforme/entreprises/${entrepriseId}/suspension`, {
      methode: 'POST',
      corps: demande,
    })
    await clientRequetes.refetchQueries({ queryKey: requete.queryKey })
    fermer(t('plateforme.entreprises.suspension.faite', { nom: donnees.nom }))
  }

  async function reactiver() {
    setEnCours(true)
    setErreurReactivation(null)
    try {
      await appelerApi(`/plateforme/entreprises/${entrepriseId}/reactivation`, { methode: 'POST' })
      await clientRequetes.refetchQueries({ queryKey: requete.queryKey })
      fermer(t('plateforme.entreprises.reactivation.faite', { nom: donnees.nom }))
    } catch (echec) {
      setErreurReactivation(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/plateforme"
        className="inline-flex min-h-cible-min items-center gap-1.5 self-start text-libelle text-encre"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        {t('plateforme.entreprises.titre')}
      </Link>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 grow flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-titre-page text-encre">{donnees.nom}</h1>
            <BadgeStatut ton={donnees.statut === 'ACTIVE' ? 'succes' : 'danger'}>
              {t(`plateforme.entreprises.statut.${donnees.statut}`)}
            </BadgeStatut>
          </div>
          <p className="m-0 text-legende text-attenue">
            {t('plateforme.fiche.clienteDepuis', {
              date: formaterDate(donnees.creeLe, FUSEAU_APPAREIL),
            })}
          </p>
        </div>
        {donnees.statut === 'ACTIVE' ? (
          <Bouton
            variante="danger"
            onClick={() => {
              setOuvert('suspension')
            }}
          >
            {t('plateforme.entreprises.suspendre')}
          </Bouton>
        ) : (
          <Bouton
            onClick={() => {
              setErreurReactivation(null)
              setOuvert('reactivation')
            }}
          >
            {t('plateforme.entreprises.reactiver')}
          </Bouton>
        )}
        <Bouton
          variante="principal"
          icone={Pencil}
          onClick={() => {
            setOuvert('modification')
          }}
        >
          {t('plateforme.fiche.modifier')}
        </Bouton>
      </div>

      {message !== null && <Alerte ton={message.ton}>{message.texte}</Alerte>}

      {donnees.suspension !== undefined && (
        <section
          aria-label={t('plateforme.fiche.suspension.titre')}
          className="rounded-moyen border border-danger-bord bg-danger-fond p-4 text-corps text-encre"
        >
          <p className="m-0 font-semibold">
            {t(`plateforme.fiche.suspension.raisons.${donnees.suspension.raison}`)}
            {donnees.suspension.precision !== undefined && ` : ${donnees.suspension.precision}`}
          </p>
          <p className="m-0 text-legende text-attenue">
            {t('plateforme.fiche.suspension.depuis', {
              date: formaterDateHeure(donnees.suspension.le, FUSEAU_APPAREIL),
            })}
          </p>
        </section>
      )}

      <Utilisation fiche={donnees} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Identite fiche={donnees} />
        <Proprietaires fiche={donnees} />
      </div>

      <Etablissements fiche={donnees} />

      {ouvert === 'modification' && (
        <DialogueModifierEntreprise
          fiche={donnees}
          surFermer={() => {
            setOuvert(null)
          }}
          surEnregistrer={modifier}
        />
      )}
      {ouvert === 'suspension' && (
        <DialogueSuspension
          fiche={donnees}
          surFermer={() => {
            setOuvert(null)
          }}
          surSuspendre={suspendre}
        />
      )}
      {ouvert === 'reactivation' && (
        <Dialogue
          titre={t('plateforme.entreprises.reactivation.titre', { nom: donnees.nom })}
          consequence={t('plateforme.entreprises.reactivation.consequence')}
          libelleAnnuler={t('plateforme.entreprises.reactivation.annuler')}
          libelleConfirmer={t('plateforme.entreprises.reactivation.confirmer')}
          enCours={enCours}
          surAnnuler={() => {
            setOuvert(null)
          }}
          surConfirmer={() => void reactiver()}
        >
          {erreurReactivation !== null && <AlerteErreur erreur={erreurReactivation} />}
        </Dialogue>
      )}
    </div>
  )
}

function Utilisation({ fiche }: Readonly<{ fiche: FicheEntreprisePlateforme }>) {
  const { t } = useTranslation()
  const { utilisation } = fiche
  const nombre = (valeur: number) => valeur.toLocaleString('fr-FR')
  const tuiles = [
    {
      libelle: t('plateforme.fiche.utilisation.utilisateurs'),
      valeur: nombre(utilisation.utilisateursActifs),
      detail: t('plateforme.fiche.utilisation.avecBackOffice', {
        count: utilisation.avecBackOffice,
      }),
    },
    {
      libelle: t('plateforme.fiche.utilisation.tablettes'),
      valeur: nombre(utilisation.tablettes),
      detail:
        utilisation.tablettesRevoquees > 0
          ? t('plateforme.fiche.utilisation.revoquees', { count: utilisation.tablettesRevoquees })
          : '',
    },
    {
      libelle: t('plateforme.fiche.utilisation.notes'),
      valeur: nombre(utilisation.notesSeptJours),
      detail: t('plateforme.fiche.utilisation.semainePrecedente', {
        nombre: nombre(utilisation.notesSemainePrecedente),
      }),
    },
    {
      libelle: t('plateforme.fiche.utilisation.derniereConnexion'),
      valeur:
        utilisation.derniereConnexionLe === undefined
          ? t('plateforme.fiche.jamais')
          : formaterDateHeure(utilisation.derniereConnexionLe, FUSEAU_APPAREIL),
      detail: utilisation.derniereConnexionPar ?? '',
    },
  ]
  return (
    <ul
      aria-label={t('plateforme.fiche.utilisation.titre')}
      className="m-0 grid list-none grid-cols-2 gap-px overflow-hidden rounded-moyen border border-trait bg-trait p-0 lg:grid-cols-4"
    >
      {tuiles.map((tuile) => (
        <li key={tuile.libelle} className="flex flex-col gap-0.5 bg-surface p-4">
          <span className="text-legende text-attenue">{tuile.libelle}</span>
          <span className="chiffres text-montant-ligne font-bold text-encre">{tuile.valeur}</span>
          <span className="text-legende text-attenue">{tuile.detail}</span>
        </li>
      ))}
    </ul>
  )
}

function Ligne({ terme, children }: Readonly<{ terme: string; children: React.ReactNode }>) {
  return (
    <>
      <dt className="text-attenue">{terme}</dt>
      <dd className="m-0 font-semibold text-encre">{children}</dd>
    </>
  )
}

function Identite({ fiche }: Readonly<{ fiche: FicheEntreprisePlateforme }>) {
  const { t, i18n } = useTranslation()
  return (
    <section
      aria-labelledby="fiche-identite"
      className="flex flex-col gap-3 rounded-moyen border border-trait bg-surface p-4"
    >
      <h2 id="fiche-identite" className="m-0 text-titre-section text-encre">
        {t('plateforme.fiche.identite')}
      </h2>
      <dl className="m-0 grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-corps">
        <Ligne terme={t('plateforme.fiche.pays')}>{nomPays(fiche.pays, i18n.language)}</Ligne>
        <Ligne terme={t('plateforme.fiche.devise')}>{fiche.devise}</Ligne>
        <Ligne terme={t('plateforme.fiche.numeroFiscal')}>
          {fiche.numeroFiscal === undefined ? (
            <span className="font-normal text-attenue">{t('plateforme.fiche.nonRenseigne')}</span>
          ) : (
            <span className="chiffres">{fiche.numeroFiscal}</span>
          )}
        </Ligne>
        {fiche.tvaDepart !== undefined && (
          <Ligne terme={t('plateforme.fiche.tvaDepart')}>
            {`${(fiche.tvaDepart / 100).toLocaleString('fr-FR')} %`}
          </Ligne>
        )}
      </dl>
    </section>
  )
}

function Proprietaires({ fiche }: Readonly<{ fiche: FicheEntreprisePlateforme }>) {
  const { t } = useTranslation()
  return (
    <section
      aria-labelledby="fiche-proprietaire"
      className="flex flex-col gap-3 rounded-moyen border border-trait bg-surface p-4"
    >
      <h2 id="fiche-proprietaire" className="m-0 text-titre-section text-encre">
        {t('plateforme.fiche.proprietaire', { count: fiche.proprietaires.length })}
      </h2>
      {fiche.proprietaires.map((proprietaire) => (
        <dl
          key={`${proprietaire.prenom} ${proprietaire.nom}`}
          className="m-0 grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-corps"
        >
          <Ligne terme={t('plateforme.fiche.nom')}>
            {proprietaire.prenom} {proprietaire.nom}
          </Ligne>
          {proprietaire.telephone !== undefined && (
            <Ligne terme={t('plateforme.fiche.telephone')}>
              <a className="chiffres text-encre" href={`tel:${proprietaire.telephone}`}>
                {proprietaire.telephone}
              </a>
            </Ligne>
          )}
          {proprietaire.email !== undefined && (
            <Ligne terme={t('plateforme.fiche.email')}>{proprietaire.email}</Ligne>
          )}
          <Ligne terme={t('plateforme.fiche.derniereConnexion')}>
            {proprietaire.derniereConnexionLe === undefined
              ? t('plateforme.fiche.jamais')
              : formaterDateHeure(proprietaire.derniereConnexionLe, FUSEAU_APPAREIL)}
          </Ligne>
        </dl>
      ))}
    </section>
  )
}

function Etablissements({ fiche }: Readonly<{ fiche: FicheEntreprisePlateforme }>) {
  const { t } = useTranslation()
  const colonnes: ColonneTableau<Etablissement>[] = [
    {
      cle: 'code',
      entete: t('plateforme.fiche.etablissements.code'),
      rendu: (e) => <BadgeStatut ton="neutre">{e.code}</BadgeStatut>,
      masqueeSurTelephone: true,
    },
    { cle: 'nom', entete: t('plateforme.fiche.etablissements.nom'), rendu: (e) => e.nom },
    {
      cle: 'ville',
      entete: t('plateforme.fiche.etablissements.ville'),
      rendu: (e) => e.ville ?? '',
      masqueeSurTelephone: true,
    },
    {
      cle: 'tablettes',
      entete: t('plateforme.fiche.etablissements.tablettes'),
      rendu: (e) => e.tablettes,
      numerique: true,
      masqueeSurTelephone: true,
    },
    {
      cle: 'vente',
      entete: t('plateforme.fiche.etablissements.derniereVente'),
      rendu: (e) =>
        e.derniereVenteLe === undefined ? (
          <span className="text-attenue">{t('plateforme.entreprises.aucuneVente')}</span>
        ) : (
          formaterDateHeure(e.derniereVenteLe, FUSEAU_APPAREIL)
        ),
    },
    {
      cle: 'statut',
      entete: t('plateforme.fiche.etablissements.statut'),
      rendu: (e) => (
        <BadgeStatut ton={e.actif ? 'succes' : 'neutre'}>
          {t(
            e.actif
              ? 'plateforme.fiche.etablissements.actif'
              : 'plateforme.fiche.etablissements.inactif',
          )}
        </BadgeStatut>
      ),
    },
  ]
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-titre-section text-encre">
        {t('plateforme.fiche.etablissements.titre')}
      </h2>
      <Tableau
        libelle={t('plateforme.fiche.etablissements.tableau')}
        colonnes={colonnes}
        lignes={fiche.etablissements}
        cleLigne={(e) => e.id}
      />
    </section>
  )
}
