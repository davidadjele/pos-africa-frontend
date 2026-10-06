import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { CircleHelp, LayoutDashboard, UserRoundCog } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { guideDe } from '../../fonctionnalites/manuel/guides'
import { PriseDeCaisse } from '../../fonctionnalites/caisse/PriseDeCaisse'
import { requeteSessionCaisse } from '../../fonctionnalites/caisse/requetes'
import { useVerrouillageInactivite } from '../../fonctionnalites/caisse/useVerrouillageInactivite'
import { requeteAppareil } from '../../fonctionnalites/tablette/requetes'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type { ReponseJetonCaisse } from '../../partage/api/contrat'
import {
  definirJetonCaisse,
  effacerJetonCaisse,
  useJetonCaisse,
} from '../../partage/api/jetonCaisse'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { CLASSES_CONTROLE_BARRE } from './MenuCompte'

/** Le jeton de caisse dure 15 minutes : il est prolongé bien avant, tant que la caisse est ouverte. */
const INTERVALLE_RENOUVELLEMENT = 10 * 60_000

/**
 * Caisse plein écran d'une tablette enregistrée : la barre dit où l'on est (établissement, caisse) et
 * qui tient la caisse. Sans session de caisse, l'écran est « Qui prend la caisse ? ».
 */
export function MiseEnPageCaisse() {
  const { t } = useTranslation()
  const { data: appareil } = useQuery(requeteAppareil)
  const jeton = useJetonCaisse()
  const chemin = useRouterState({ select: (etat) => etat.location.pathname })
  const session = useQuery({ ...requeteSessionCaisse(jeton ?? ''), enabled: jeton !== null })
  return (
    <div className="flex h-dvh flex-col bg-fond">
      <BarreHaute
        {...(appareil
          ? {
              contexte: {
                titre: appareil.entreprise.nom,
                detail: `${appareil.etablissement.nom}, ${appareil.nom}`,
              },
            }
          : {})}
      >
        {jeton !== null && session.data && (
          <>
            <span className="hidden flex-col items-end sm:flex">
              <span className="text-libelle font-semibold">{session.data.nomCourt}</span>
              <span className="text-legende text-barre-attenue">
                {t(`roles.${session.data.role}`)}
              </span>
            </span>
            <button
              type="button"
              aria-label={t('caisse.session.changer')}
              className={CLASSES_CONTROLE_BARRE}
              onClick={effacerJetonCaisse}
            >
              <UserRoundCog aria-hidden="true" size={18} />
              {/* Sur téléphone, l'icône seule : la barre garde la place de la marque. */}
              <span className="hidden sm:inline">{t('caisse.session.changer')}</span>
            </button>
          </>
        )}
        <Link
          to="/aide/$guide"
          params={{ guide: guideDe(chemin) }}
          aria-label={t('aide.lien')}
          className={CLASSES_CONTROLE_BARRE}
        >
          <CircleHelp aria-hidden="true" size={18} />
          <span className="hidden sm:inline">{t('aide.lien')}</span>
        </Link>
        <Link to="/gestion" aria-label={t('commun.gestion')} className={CLASSES_CONTROLE_BARRE}>
          <LayoutDashboard aria-hidden="true" size={18} />
          <span className="hidden sm:inline">{t('commun.gestion')}</span>
        </Link>
      </BarreHaute>
      {appareil &&
        (jeton === null ? (
          <PriseDeCaisse appareil={appareil} />
        ) : (
          <main className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
            <GardienSession delaiMinutes={appareil.delaiVerrouillageMinutes} />
            <Outlet />
          </main>
        ))}
    </div>
  )
}

/** Verrouille après inactivité et prolonge le jeton tant que la session est ouverte. */
function GardienSession({ delaiMinutes }: Readonly<{ delaiMinutes: number }>) {
  useVerrouillageInactivite(delaiMinutes, effacerJetonCaisse)
  useEffect(() => {
    const minuterie = setInterval(() => {
      // Un refus 401 ferme déjà la session (appelerCaisse) ; une panne réseau se retente au tour suivant.
      appelerCaisse<ReponseJetonCaisse>('/caisse/session', { methode: 'POST' })
        .then((reponse) => {
          definirJetonCaisse(reponse.jetonAcces)
        })
        .catch(() => undefined)
    }, INTERVALLE_RENOUVELLEMENT)
    return () => {
      clearInterval(minuterie)
    }
  }, [])
  return null
}
