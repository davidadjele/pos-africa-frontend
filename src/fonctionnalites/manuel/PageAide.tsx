import { Link } from '@tanstack/react-router'
import { ChefHat, ChevronRight, CircleHelp, MonitorSmartphone, Store } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { EtatVide } from '../../partage/ui/EtatVide'
import { chercherGuides, GUIDES, trouverGuide, type RoleGuide } from './guides'
import { MiseEnPageAide } from './MiseEnPageAide'

type RoleAccueil = Exclude<RoleGuide, 'depannage'>

/** Une carte par rôle ; le dépannage a son propre encadré, en bas de l'accueil. */
const ROLES_ACCUEIL: RoleAccueil[] = ['gestion', 'caisse', 'cuisine']

const ICONES: Record<RoleAccueil, typeof Store> = {
  gestion: Store,
  caisse: MonitorSmartphone,
  cuisine: ChefHat,
}

const CLASSES_CARTE = 'rounded-moyen border border-trait bg-surface'

/** L'accueil de l'aide : un point d'entrée par rôle, le premier jour dans l'ordre, et une recherche. */
export function PageAide() {
  const { t } = useTranslation()
  const [recherche, setRecherche] = useState('')
  const enRecherche = recherche.trim() !== ''
  return (
    <MiseEnPageAide>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1 basis-80">
            <h1 className="m-0 text-titre-ecran text-encre">{t('aide.accueil.titre')}</h1>
            <p className="m-0 mt-2 text-corps text-attenue">{t('aide.accueil.phrase')}</p>
          </div>
          <div className="w-full sm:w-96">
            <ChampSaisie
              type="search"
              libelle={t('aide.rechercher')}
              placeholder={t('aide.exempleRecherche')}
              value={recherche}
              onChange={(evenement) => {
                setRecherche(evenement.target.value)
              }}
            />
          </div>
        </div>
        {enRecherche ? <Resultats recherche={recherche} /> : <Accueil />}
      </main>
    </MiseEnPageAide>
  )
}

function Resultats({ recherche }: Readonly<{ recherche: string }>) {
  const { t } = useTranslation()
  const trouves = chercherGuides(recherche)
  return (
    <section aria-label={t('aide.resultats')} className={CLASSES_CARTE}>
      {trouves.length === 0 ? (
        <div className="p-6">
          <EtatVide
            titre={t('aide.aucunResultat', { recherche: recherche.trim() })}
            phrase={t('aide.erreur.phrase')}
          />
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {trouves.map((guide) => (
            <li key={guide.id} className="border-b border-trait last:border-b-0">
              <Link
                to="/aide/$guide"
                params={{ guide: guide.id }}
                className="flex min-h-cible-min items-center gap-3 px-4 py-3 text-encre hover:bg-fond"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-corps-fort">{guide.titre}</span>
                  <span className="block text-legende text-attenue">{guide.objectif}</span>
                </span>
                <ChevronRight aria-hidden="true" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Accueil() {
  const { t } = useTranslation()
  const idPremierJour = useId()
  const premierJour = trouverGuide('premier-jour')
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {ROLES_ACCUEIL.map((role) => (
          <CarteRole key={role} role={role} />
        ))}
      </div>
      {premierJour !== undefined && (
        <section aria-labelledby={idPremierJour} className={`${CLASSES_CARTE} p-4 md:p-6`}>
          <h2 id={idPremierJour} className="m-0 text-titre-section text-encre">
            {premierJour.titre}
          </h2>
          <p className="m-0 mt-1 text-libelle text-attenue">{t('aide.premierJour.phrase')}</p>
          <ol className="m-0 mt-3 grid list-none gap-x-8 p-0 md:grid-cols-2">
            {premierJour.etapes.map((etape, rang) => (
              <li key={etape.titre} className="border-t border-trait">
                <Link
                  to="/aide/$guide"
                  params={{ guide: premierJour.id }}
                  hash={`etape-${String(rang + 1)}`}
                  aria-label={`${String(rang + 1)}. ${etape.titre}`}
                  className="flex min-h-cible-min items-center gap-3 py-2 text-encre hover:bg-fond"
                >
                  <span className="chiffres flex size-8 shrink-0 items-center justify-center rounded-normal bg-accent text-corps-fort text-accent-texte">
                    {rang + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-corps-fort">{etape.titre}</span>
                  <ChevronRight aria-hidden="true" size={18} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className={`${CLASSES_CARTE} flex items-start gap-4 p-4`}>
        <CircleHelp aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-encre" />
        <div>
          <h2 className="m-0 text-corps-fort text-encre">{t('aide.erreur.titre')}</h2>
          <p className="m-0 mt-1 text-libelle text-attenue">{t('aide.erreur.phrase')}</p>
          <Link
            to="/aide/$guide"
            params={{ guide: 'depannage' }}
            className="mt-2 inline-flex min-h-cible-min items-center gap-1 text-corps-fort text-accent-lisible underline"
          >
            {t('aide.erreur.lien')}
            <ChevronRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </section>
    </>
  )
}

function CarteRole({ role }: Readonly<{ role: RoleAccueil }>) {
  const { t } = useTranslation()
  const id = useId()
  const Icone = ICONES[role]
  return (
    <section aria-labelledby={id} className={`${CLASSES_CARTE} flex flex-col gap-3 p-4 md:p-5`}>
      <span className="flex size-11 items-center justify-center rounded-normal bg-accent-doux text-accent-lisible">
        <Icone aria-hidden="true" size={20} />
      </span>
      <h2 id={id} className="m-0 text-titre-carte text-encre">
        {t(`aide.roles.${role}`)}
      </h2>
      <p className="m-0 text-libelle text-attenue">{t(`aide.rolesPhrase.${role}`)}</p>
      <ul className="m-0 list-none border-t border-trait p-0">
        {GUIDES.filter((guide) => guide.role === role).map((guide) => (
          <li key={guide.id} className="border-b border-trait">
            <Link
              to="/aide/$guide"
              params={{ guide: guide.id }}
              className="flex min-h-cible-min items-center justify-between gap-2 text-corps-fort text-encre hover:bg-fond"
            >
              {guide.titre}
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
