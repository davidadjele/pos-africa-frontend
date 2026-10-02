import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Clock, OctagonAlert, RotateCw } from 'lucide-react'
import { useCallback, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  AppareilCourant,
  DemandePriseDeCaisse,
  ProfilCaisse,
  ResultatPriseDeCaisse,
} from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { definirJetonCaisse } from '../../partage/api/jetonCaisse'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { EcranNouveauPin } from './EcranNouveauPin'
import { Pastille } from './Pastille'
import { requetePersonnelCaisse } from './requetes'
import { LONGUEUR_MIN_PIN, LONGUEUR_PIN_TEMPORAIRE, SaisieCode } from './SaisieCode'
import { useVerrouillageInactivite } from './useVerrouillageInactivite'

type Etape =
  | { type: 'choix' }
  | { type: 'pin'; profil: ProfilCaisse }
  | { type: 'bloque'; profil: ProfilCaisse }
  | { type: 'nouveauPin'; profil: ProfilCaisse; pinActuel: string }

/** « Qui prend la caisse ? » : l'employé touche son nom, tape son PIN, et la caisse s'ouvre à son nom. */
export function PriseDeCaisse({ appareil }: Readonly<{ appareil: AppareilCourant }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const personnel = useQuery(requetePersonnelCaisse)
  const [etape, setEtape] = useState<Etape>({ type: 'choix' })

  // Un employé parti au milieu de sa saisie ne laisse pas son profil ouvert à l'écran.
  const revenirAuChoix = useCallback(() => {
    setEtape({ type: 'choix' })
  }, [])
  useVerrouillageInactivite(appareil.delaiVerrouillageMinutes, revenirAuChoix)

  function ouvrir(jeton: string) {
    void clientRequetes.invalidateQueries({ queryKey: requetePersonnelCaisse.queryKey })
    definirJetonCaisse(jeton)
  }

  function bloquer(profil: ProfilCaisse) {
    void clientRequetes.invalidateQueries({ queryKey: requetePersonnelCaisse.queryKey })
    setEtape({ type: 'bloque', profil })
  }

  if (etape.type === 'nouveauPin') {
    return (
      <EcranNouveauPin
        profil={etape.profil}
        pinActuel={etape.pinActuel}
        etablissement={appareil.etablissement.nom}
        surOuvert={ouvrir}
        surBloque={() => {
          bloquer(etape.profil)
        }}
        surAbandon={revenirAuChoix}
      />
    )
  }

  const profilChoisi = etape.type === 'choix' ? undefined : etape.profil
  let liste: ReactNode
  if (personnel.isPending) {
    liste = <Chargement texte={t('caisse.prise.chargement')} />
  } else if (personnel.isError) {
    liste = (
      <AlerteErreur
        erreur={personnel.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void personnel.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  } else if (personnel.data.length === 0) {
    liste = (
      <EtatVide
        titre={t('caisse.prise.vide.titre')}
        phrase={t('caisse.prise.vide.phrase', { etablissement: appareil.etablissement.nom })}
      />
    )
  } else {
    liste = (
      <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {personnel.data.map((profil) => (
          <li key={profil.utilisateurId}>
            <button
              type="button"
              aria-pressed={profil.utilisateurId === profilChoisi?.utilisateurId}
              onClick={() => {
                setEtape(profil.bloque ? { type: 'bloque', profil } : { type: 'pin', profil })
              }}
              className={clsx(
                'flex h-[76px] w-full items-center gap-3 rounded-moyen bg-surface px-4 text-left text-encre',
                profil.utilisateurId === profilChoisi?.utilisateurId
                  ? 'border-2 border-accent'
                  : 'border border-trait hover:border-bordure-controle',
              )}
            >
              <Pastille nomCourt={profil.nomCourt} />
              <span className="flex min-w-0 flex-col items-start gap-1">
                <span className="truncate text-corps-fort">{profil.nomCourt}</span>
                {profil.bloque ? (
                  <BadgeStatut ton="danger">{t('caisse.prise.bloque')}</BadgeStatut>
                ) : (
                  <span className="text-legende text-attenue">{t(`roles.${profil.role}`)}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto md:flex-row">
      <main className="flex flex-1 flex-col gap-5 p-6 md:px-10 md:py-8">
        <div>
          <h1 className="m-0 text-titre-ecran text-encre">{t('caisse.prise.titre')}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('caisse.prise.phrase')}</p>
        </div>
        {liste}
        <p className="m-0 mt-auto flex items-center gap-2.5 rounded-moyen border border-trait bg-surface px-4 py-3 text-legende text-attenue">
          <Clock aria-hidden="true" size={16} className="shrink-0" />
          {t('caisse.prise.verrouillage', { count: appareil.delaiVerrouillageMinutes })}
        </p>
      </main>
      <aside className="flex w-full flex-col gap-5 border-t border-trait bg-surface p-6 md:w-[460px] md:border-t-0 md:border-l md:p-9">
        {etape.type === 'pin' && (
          <PanneauPin
            key={etape.profil.utilisateurId}
            profil={etape.profil}
            surOuvert={ouvrir}
            surPinAChanger={(pinActuel) => {
              setEtape({ type: 'nouveauPin', profil: etape.profil, pinActuel })
            }}
            surBloque={() => {
              bloquer(etape.profil)
            }}
            surAutreProfil={revenirAuChoix}
          />
        )}
        {etape.type === 'bloque' && (
          <PanneauBloque profil={etape.profil} surAutreProfil={revenirAuChoix} />
        )}
        {etape.type === 'choix' && (
          <p className="m-0 my-auto text-center text-corps text-attenue">
            {t('caisse.prise.choisir')}
          </p>
        )}
      </aside>
    </div>
  )
}

function EnTeteProfil({ profil, idNom }: Readonly<{ profil: ProfilCaisse; idNom: string }>) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3.5">
      <Pastille nomCourt={profil.nomCourt} />
      <span className="flex flex-col">
        <span id={idNom} className="text-titre-carte text-encre">
          {profil.nomCourt}
        </span>
        <span className="text-legende text-attenue">{t(`roles.${profil.role}`)}</span>
      </span>
    </div>
  )
}

function PanneauPin({
  profil,
  surOuvert,
  surPinAChanger,
  surBloque,
  surAutreProfil,
}: Readonly<{
  profil: ProfilCaisse
  surOuvert: (jeton: string) => void
  surPinAChanger: (pinActuel: string) => void
  surBloque: () => void
  surAutreProfil: () => void
}>) {
  const { t } = useTranslation()
  const idNom = useId()
  const [code, setCode] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function envoyer() {
    setEnCours(true)
    setErreur(null)
    try {
      const resultat = await appelerApi<ResultatPriseDeCaisse>('/appareil/connexion', {
        methode: 'POST',
        corps: { utilisateurId: profil.utilisateurId, pin: code } satisfies DemandePriseDeCaisse,
      })
      if (resultat.statut === 'PIN_A_CHANGER') surPinAChanger(code)
      else if (resultat.jetonAcces !== undefined) surOuvert(resultat.jetonAcces)
    } catch (refus) {
      if (refus instanceof ErreurApi && refus.code === 'PROFIL_BLOQUE') {
        surBloque()
        return
      }
      setErreur(refus)
      setCode('')
      setEnCours(false)
    }
  }

  return (
    <section aria-labelledby={idNom} className="flex flex-1 flex-col gap-5">
      <EnTeteProfil profil={profil} idNom={idNom} />
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <SaisieCode
        libelle={t('caisse.prise.tapezCode')}
        code={code}
        {...(profil.pinAChanger ? { longueur: LONGUEUR_PIN_TEMPORAIRE } : {})}
        surChanger={setCode}
        desactive={enCours}
      />
      <Bouton
        variante="principal"
        disabled={code.length < LONGUEUR_MIN_PIN}
        enCours={enCours}
        onClick={() => void envoyer()}
      >
        {t('caisse.prise.ouvrir')}
      </Bouton>
      <Bouton onClick={surAutreProfil}>{t('caisse.prise.autreProfil')}</Bouton>
    </section>
  )
}

function PanneauBloque({
  profil,
  surAutreProfil,
}: Readonly<{ profil: ProfilCaisse; surAutreProfil: () => void }>) {
  const { t } = useTranslation()
  const idNom = useId()
  return (
    <section aria-labelledby={idNom} className="flex flex-1 flex-col gap-5">
      <EnTeteProfil profil={profil} idNom={idNom} />
      <div className="flex flex-col gap-2.5 rounded-moyen border border-danger-bord bg-danger-fond p-4 text-encre">
        <span className="flex items-center gap-2.5 text-corps-fort text-danger">
          <OctagonAlert aria-hidden="true" size={20} />
          {t('caisse.bloque.titre')}
        </span>
        <span className="text-corps">{t('caisse.bloque.phrase')}</span>
      </div>
      <div className="flex flex-col gap-2 text-corps">
        <span className="text-corps-fort text-encre">{t('caisse.bloque.debloquer')}</span>
        <span className="text-attenue">{t('caisse.bloque.marche', { prenom: profil.prenom })}</span>
      </div>
      <Bouton className="mt-auto" onClick={surAutreProfil}>
        {t('caisse.prise.autreProfil')}
      </Bouton>
    </section>
  )
}
