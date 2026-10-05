import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { Menu, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../partage/auth/useSession'
import { nomPays } from '../../partage/referentiel/pays'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { requeteARelancer } from '../../fonctionnalites/ardoise/requetes'
import { requeteStockATraiter } from '../../fonctionnalites/stock/requetes'
import { MenuCompte } from './MenuCompte'
import {
  ongletDe,
  ongletsVisibles,
  sectionDe,
  sectionsVisibles,
  type Compteur,
  type Onglet,
} from './navigationGestion'

/** Ce qui attend une action, par compteur ; une requête ne part que si un onglet visible l'affiche. */
function useCompteurs(actifs: ReadonlySet<Compteur>): Record<Compteur, number> {
  const stock = useQuery({ ...requeteStockATraiter, enabled: actifs.has('stock') })
  const ardoises = useQuery({ ...requeteARelancer, enabled: actifs.has('ardoises') })
  return { stock: stock.data?.nombre ?? 0, ardoises: ardoises.data?.nombre ?? 0 }
}

function Pastille({ nombre }: Readonly<{ nombre: number }>) {
  const { t } = useTranslation()
  if (nombre === 0) return null
  return (
    <span className="chiffres ml-auto min-w-5 rounded-petit bg-accent-vif px-1.5 text-center text-badge font-bold text-accent-texte">
      <span className="sr-only">, {t('gestion.menu.aTraiter', { count: nombre })} </span>
      <span aria-hidden="true">{nombre}</span>
    </span>
  )
}

function total(onglets: readonly Onglet[], nombres: Record<Compteur, number>): number {
  return onglets.reduce(
    (somme, { compteur }) => somme + (compteur === undefined ? 0 : nombres[compteur]),
    0,
  )
}

export function MiseEnPageGestion() {
  const { t, i18n } = useTranslation()
  const { moi, aLaPermission } = useSession()
  const chemin = useRouterState({ select: (etat) => etat.location.pathname })
  const [erreurChangement, setErreurChangement] = useState<unknown>(null)
  const [menuOuvert, setMenuOuvert] = useState(false)
  const idMenu = useId()
  const sections = sectionsVisibles(aLaPermission)
  const nombres = useCompteurs(
    new Set(
      sections.flatMap((section) =>
        section.visibles.flatMap(({ compteur }) => (compteur === undefined ? [] : [compteur])),
      ),
    ),
  )
  const active = sectionDe(chemin)
  const onglets = active === undefined ? [] : ongletsVisibles(active, aLaPermission)
  const ongletActif = active === undefined ? undefined : ongletDe(chemin, active)
  const entreprise = moi?.entrepriseCourante

  useEffect(() => {
    if (!menuOuvert) return
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setMenuOuvert(false)
    }
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
    }
  }, [menuOuvert])

  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute
        {...(entreprise
          ? { contexte: { titre: entreprise.nom, detail: nomPays(entreprise.pays, i18n.language) } }
          : {})}
      >
        <MenuCompte surErreur={setErreurChangement} />
      </BarreHaute>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label={t('commun.navigationPrincipale')}
          // Fixe sous la barre : une ligne « Menu » sur téléphone, une colonne qui défile seule sur grand écran.
          className="sticky top-barre-hauteur z-20 shrink-0 border-b border-trait bg-surface md:h-[calc(100dvh-var(--barre-hauteur))] md:w-60 md:self-start md:overflow-y-auto md:border-r md:border-b-0"
        >
          <button
            type="button"
            aria-expanded={menuOuvert}
            aria-controls={idMenu}
            onClick={() => {
              setMenuOuvert(!menuOuvert)
            }}
            className="flex min-h-cible-min w-full items-center gap-3 px-4 text-corps font-semibold text-encre md:hidden"
          >
            {menuOuvert ? (
              <X aria-hidden="true" size={20} />
            ) : (
              <Menu aria-hidden="true" size={20} />
            )}
            <span className="sr-only">{t('gestion.menu.ouvrir')}</span>
            <span aria-hidden="true">
              {active === undefined ? t('gestion.menu.ouvrir') : t(`gestion.menu.${active.cle}`)}
            </span>
          </button>
          <ul
            id={idMenu}
            className={clsx(
              'm-0 list-none flex-col gap-1 p-2 md:flex',
              menuOuvert ? 'flex border-t border-trait' : 'hidden',
            )}
          >
            {sections.map((section) => {
              const Icone = section.icone
              const courante = section.cle === active?.cle
              return (
                <li key={section.cle}>
                  <Link
                    to={section.vers}
                    activeOptions={{ exact: true }}
                    aria-current={courante ? 'page' : undefined}
                    // Sur téléphone, le menu se referme en changeant de page.
                    onClick={() => {
                      setMenuOuvert(false)
                    }}
                    className={clsx(
                      'flex min-h-cible-min items-center gap-3 whitespace-nowrap rounded-normal px-3 text-corps text-encre',
                      courante ? 'bg-accent-doux font-bold text-accent-lisible' : 'hover:bg-fond',
                    )}
                  >
                    <Icone aria-hidden="true" size={20} />
                    {t(`gestion.menu.${section.cle}`)}
                    <Pastille nombre={total(section.visibles, nombres)} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
          {active !== undefined && onglets.length > 1 && (
            <nav
              aria-label={t(`gestion.menu.${active.cle}`)}
              className="-mx-4 -mt-4 flex gap-6 overflow-x-auto border-b border-trait bg-surface px-4 md:-mx-6 md:-mt-6 md:px-6"
            >
              {onglets.map((onglet) => (
                <Link
                  key={onglet.vers}
                  to={onglet.vers}
                  activeOptions={{ exact: true }}
                  aria-current={onglet.vers === ongletActif?.vers ? 'page' : undefined}
                  className={clsx(
                    'inline-flex min-h-cible-min shrink-0 items-center gap-2 border-b-2 px-1 text-libelle text-encre',
                    onglet.vers === ongletActif?.vers
                      ? 'border-accent font-bold'
                      : 'border-transparent',
                  )}
                >
                  {t(`gestion.menu.${onglet.cle}`)}
                  {onglet.compteur !== undefined && <Pastille nombre={nombres[onglet.compteur]} />}
                </Link>
              ))}
            </nav>
          )}
          {erreurChangement !== null && <AlerteErreur erreur={erreurChangement} />}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
