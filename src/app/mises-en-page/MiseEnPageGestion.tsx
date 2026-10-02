import { Link, Outlet } from '@tanstack/react-router'
import {
  Activity,
  Building2,
  LayoutDashboard,
  LayoutGrid,
  NotebookPen,
  Percent,
  Store,
  TabletSmartphone,
  Package,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession, type Permission } from '../../partage/auth/useSession'
import { nomPays } from '../../partage/referentiel/pays'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { requeteARelancer } from '../../fonctionnalites/ardoise/requetes'
import { requeteStockATraiter } from '../../fonctionnalites/stock/requetes'
import { MenuCompte } from './MenuCompte'

interface EntreeNavigation {
  vers:
    | '/gestion'
    | '/caisse'
    | '/gestion/activite'
    | '/gestion/produits'
    | '/gestion/carte-etablissement'
    | '/gestion/taxes'
    | '/gestion/etablissements'
    | '/gestion/salles'
    | '/gestion/personnel'
    | '/gestion/tablettes'
    | '/gestion/stock'
    | '/gestion/ardoises'
  cle: string
  icone: LucideIcon
  /** Entrée masquée sans l'une de ces permissions : l'écran ne servirait qu'à afficher un refus. */
  permission?: Permission | Permission[]
  /** Nombre à côté de l'entrée : ce qui attend une action. */
  compteur?: 'stock' | 'ardoises'
}

// Les autres entrées (Ventes, Rapports…) arriveront avec leurs modules : pas de lien mort.
const QUOTIDIEN: EntreeNavigation[] = [
  { vers: '/gestion', cle: 'gestion.menu.tableauDeBord', icone: LayoutDashboard },
  { vers: '/caisse', cle: 'gestion.menu.caisse', icone: Store },
  {
    vers: '/gestion/activite',
    cle: 'gestion.menu.activite',
    icone: Activity,
    permission: 'ACTIVITE_CONSULTER',
  },
  {
    vers: '/gestion/stock',
    cle: 'gestion.menu.stock',
    icone: Package,
    permission: ['STOCK_RECEPTIONNER', 'STOCK_AJUSTER'],
    compteur: 'stock',
  },
  {
    vers: '/gestion/ardoises',
    cle: 'gestion.menu.ardoises',
    icone: NotebookPen,
    permission: 'CLIENT_CREDIT',
    compteur: 'ardoises',
  },
]

// La carte : consultable par tout le back-office, les taxes seulement par qui les règle.
const CARTE: EntreeNavigation[] = [
  { vers: '/gestion/produits', cle: 'gestion.menu.produits', icone: UtensilsCrossed },
  { vers: '/gestion/carte-etablissement', cle: 'gestion.menu.parEtablissement', icone: Store },
  {
    vers: '/gestion/taxes',
    cle: 'gestion.menu.taxes',
    icone: Percent,
    permission: 'CATALOGUE_GERER',
  },
]

// Réglages en bas, séparés des actions quotidiennes.
const REGLAGES: EntreeNavigation[] = [
  {
    vers: '/gestion/etablissements',
    cle: 'gestion.menu.etablissements',
    icone: Building2,
    permission: 'ETABLISSEMENT_GERER',
  },
  {
    vers: '/gestion/salles',
    cle: 'gestion.menu.salles',
    icone: LayoutGrid,
    permission: 'SALLE_GERER',
  },
  {
    vers: '/gestion/personnel',
    cle: 'gestion.menu.personnel',
    icone: Users,
    permission: 'PERSONNEL_GERER',
  },
  {
    vers: '/gestion/tablettes',
    cle: 'gestion.menu.tablettes',
    icone: TabletSmartphone,
    permission: 'APPAREIL_GERER',
  },
]

function Separateur() {
  return (
    <li
      aria-hidden="true"
      className="mx-1 w-px self-stretch bg-trait md:mx-0 md:my-1 md:h-px md:w-auto"
    />
  )
}

function Entree({
  vers,
  cle,
  icone: Icone,
  compteur,
}: Readonly<Omit<EntreeNavigation, 'permission'>>) {
  const { t } = useTranslation()
  const aTraiter = useQuery({ ...requeteStockATraiter, enabled: compteur === 'stock' })
  const aRelancer = useQuery({ ...requeteARelancer, enabled: compteur === 'ardoises' })
  const nombres = { stock: aTraiter.data?.nombre ?? 0, ardoises: aRelancer.data?.nombre ?? 0 }
  const nombre = compteur === undefined ? 0 : nombres[compteur]
  return (
    <li>
      <Link
        to={vers}
        activeOptions={{ exact: true }}
        className="relative flex min-h-cible-min items-center gap-3 whitespace-nowrap rounded-normal px-3 text-[14px] text-encre hover:bg-fond aria-[current=page]:bg-accent-doux aria-[current=page]:font-semibold aria-[current=page]:text-accent-lisible"
      >
        <Icone aria-hidden="true" size={18} />
        {t(cle)}
        {nombre > 0 && (
          <span className="chiffres ml-auto min-w-5 rounded-petit bg-accent-vif px-1.5 text-center text-badge font-bold text-accent-texte">
            <span className="sr-only">, {t('gestion.menu.aTraiter', { count: nombre })} </span>
            <span aria-hidden="true">{nombre}</span>
          </span>
        )}
      </Link>
    </li>
  )
}

export function MiseEnPageGestion() {
  const { t, i18n } = useTranslation()
  const { moi, aLaPermission } = useSession()
  const visible = (entree: EntreeNavigation) =>
    entree.permission === undefined ||
    (Array.isArray(entree.permission)
      ? entree.permission.some((permission) => aLaPermission(permission))
      : aLaPermission(entree.permission))
  const [erreurChangement, setErreurChangement] = useState<unknown>(null)
  const entreprise = moi?.entrepriseCourante
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
          className="shrink-0 border-b border-trait bg-surface md:w-58 md:border-r md:border-b-0"
        >
          <ul className="m-0 flex list-none gap-1 overflow-x-auto p-2 md:flex-col">
            {QUOTIDIEN.filter(visible).map((entree) => (
              <Entree
                key={entree.vers}
                vers={entree.vers}
                cle={entree.cle}
                icone={entree.icone}
                {...(entree.compteur === undefined ? {} : { compteur: entree.compteur })}
              />
            ))}
            <Separateur />
            <li
              aria-hidden="true"
              className="hidden px-3 pt-1 text-badge uppercase tracking-wide text-attenue md:block"
            >
              {t('gestion.menu.carte')}
            </li>
            {CARTE.filter(visible).map((entree) => (
              <Entree
                key={entree.vers}
                vers={entree.vers}
                cle={entree.cle}
                icone={entree.icone}
                {...(entree.compteur === undefined ? {} : { compteur: entree.compteur })}
              />
            ))}
            <Separateur />
            {REGLAGES.filter(visible).map((entree) => (
              <Entree
                key={entree.vers}
                vers={entree.vers}
                cle={entree.cle}
                icone={entree.icone}
                {...(entree.compteur === undefined ? {} : { compteur: entree.compteur })}
              />
            ))}
          </ul>
        </nav>
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
          {erreurChangement !== null && <AlerteErreur erreur={erreurChangement} />}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
