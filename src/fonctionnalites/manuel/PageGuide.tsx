import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ArrowRight, BookOpen, Info, List, TriangleAlert, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { EtatVide } from '../../partage/ui/EtatVide'
import { GUIDES, ROLES, trouverGuide, type Guide } from './guides'
import { MiseEnPageAide } from './MiseEnPageAide'
import { texteRiche } from './texteRiche'

const CLASSES_CARTE = 'rounded-moyen border border-trait bg-surface'

export function PageGuide({ id }: Readonly<{ id: string }>) {
  const { t } = useTranslation()
  const guide = trouverGuide(id)
  if (guide === undefined) {
    return (
      <MiseEnPageAide>
        <main className="mx-auto flex w-full max-w-xl flex-col p-4 md:p-8">
          <div className={`${CLASSES_CARTE} p-6`}>
            <EtatVide
              niveauTitre={1}
              titre={t('aide.introuvable.titre')}
              phrase={t('aide.introuvable.phrase')}
              action={
                <Link to="/aide" className="text-corps-fort text-accent-lisible underline">
                  {t('aide.accueilAide')}
                </Link>
              }
            />
          </div>
        </main>
      </MiseEnPageAide>
    )
  }
  return (
    <MiseEnPageAide>
      <div className="flex flex-1 flex-col md:flex-row">
        <SommaireGuides courant={guide.id} />
        <ContenuGuide key={guide.id} guide={guide} />
      </div>
    </MiseEnPageAide>
  )
}

/** Tous les guides par rôle : une colonne sur grand écran, une ligne « Guides » qui se déplie sur téléphone. */
function SommaireGuides({ courant }: Readonly<{ courant: string }>) {
  const { t } = useTranslation()
  const [ouvert, setOuvert] = useState(false)
  const idListe = useId()
  return (
    <nav
      aria-label={t('aide.guides')}
      // Fixe sous la barre sur grand écran : on change de guide sans remonter en haut d'un long guide.
      className="shrink-0 border-b border-trait bg-surface md:sticky md:top-barre-hauteur md:h-[calc(100dvh-var(--barre-hauteur))] md:w-72 md:self-start md:overflow-y-auto md:border-r md:border-b-0"
    >
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={idListe}
        onClick={() => {
          setOuvert(!ouvert)
        }}
        className="flex min-h-cible-min w-full items-center gap-3 px-4 text-corps font-semibold text-encre md:hidden"
      >
        {ouvert ? <X aria-hidden="true" size={20} /> : <List aria-hidden="true" size={20} />}
        {t('aide.guides')}
      </button>
      <div id={idListe} className={clsx('flex-col gap-1 p-3 md:flex', ouvert ? 'flex' : 'hidden')}>
        <Link
          to="/aide"
          className="flex min-h-cible-min items-center rounded-normal px-3 text-corps-fort text-encre hover:bg-fond"
        >
          {t('aide.accueilAide')}
        </Link>
        {ROLES.map((role) => (
          <div key={role}>
            <h2 className="m-0 mt-3 mb-1 px-3 text-badge uppercase tracking-wide text-attenue">
              {t(`aide.roles.${role}`)}
            </h2>
            <ul className="m-0 list-none p-0">
              {GUIDES.filter((guide) => guide.role === role).map((guide) => (
                <li key={guide.id}>
                  <Link
                    to="/aide/$guide"
                    params={{ guide: guide.id }}
                    aria-current={guide.id === courant ? 'page' : undefined}
                    className={clsx(
                      'flex min-h-cible-min items-center rounded-normal px-3 text-libelle text-encre',
                      guide.id === courant ? 'bg-accent-doux font-bold' : 'hover:bg-fond',
                    )}
                  >
                    {guide.titre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

function ContenuGuide({ guide }: Readonly<{ guide: Guide }>) {
  const { t } = useTranslation()
  const idExemple = useId()
  const idBon = useId()
  const idProblemes = useId()
  const suivant = guide.suivant === undefined ? undefined : trouverGuide(guide.suivant)
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <p className="m-0 text-legende text-attenue">{t(`aide.roles.${guide.role}`)}</p>
        <h1 className="m-0 mt-1 text-titre-ecran text-encre">{guide.titre}</h1>
        <p className="m-0 mt-2 text-corps text-attenue">{guide.objectif}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {guide.pour.map((qui) => (
            <BadgeStatut key={qui} ton="neutre">
              {qui}
            </BadgeStatut>
          ))}
        </div>
      </div>
      <section
        aria-labelledby={idExemple}
        className="flex flex-col gap-1.5 rounded-moyen bg-accent-doux p-4"
      >
        <h2
          id={idExemple}
          className="m-0 flex items-center gap-2 text-corps-fort text-accent-lisible"
        >
          <BookOpen aria-hidden="true" size={18} />
          {t('aide.exemple')}
        </h2>
        <p className="m-0 text-corps text-encre">{guide.exemple}</p>
      </section>
      <ol aria-label={t('aide.etapes')} className="m-0 flex list-none flex-col gap-8 p-0">
        {guide.etapes.map((etape, rang) => (
          <li
            key={etape.titre}
            id={`etape-${String(rang + 1)}`}
            className="grid scroll-mt-24 grid-cols-[2.25rem_minmax(0,1fr)] gap-3"
          >
            <span className="chiffres flex size-8 items-center justify-center rounded-normal bg-accent text-corps-fort text-accent-texte">
              {rang + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <h2 className="m-0 text-titre-carte text-encre">{etape.titre}</h2>
              <p className="m-0 text-corps text-encre">{texteRiche(etape.texte)}</p>
              {etape.capture !== undefined && (
                <figure className="m-0 overflow-hidden rounded-moyen border border-trait bg-surface">
                  {/* La capture s'ouvre en grand dans un nouvel onglet : on y zoome au doigt sur tablette. */}
                  <a
                    href={`/manuel/${etape.capture.fichier}.jpg`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t('aide.agrandir', { legende: etape.capture.legende })}
                  >
                    <img
                      src={`/manuel/${etape.capture.fichier}.jpg`}
                      alt={etape.capture.legende}
                      width={1280}
                      height={800}
                      loading="lazy"
                      className="block h-auto w-full"
                    />
                  </a>
                  <figcaption className="border-t border-trait px-3 py-2 text-legende text-attenue">
                    {etape.capture.legende}
                  </figcaption>
                </figure>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby={idBon} className={`${CLASSES_CARTE} flex flex-col gap-2 p-4`}>
          <h2 id={idBon} className="m-0 flex items-center gap-2 text-corps-fort text-encre">
            <Info aria-hidden="true" size={18} />
            {t('aide.bonASavoir')}
          </h2>
          <ul className="m-0 flex flex-col gap-1.5 pl-5 text-corps text-encre">
            {guide.bonASavoir.map((conseil) => (
              <li key={conseil}>{texteRiche(conseil)}</li>
            ))}
          </ul>
        </section>
        <section
          aria-labelledby={idProblemes}
          className={`${CLASSES_CARTE} flex flex-col gap-2 p-4`}
        >
          <h2 id={idProblemes} className="m-0 flex items-center gap-2 text-corps-fort text-encre">
            <TriangleAlert aria-hidden="true" size={18} />
            {t('aide.problemes')}
          </h2>
          <dl className="m-0 flex flex-col gap-3">
            {guide.problemes.map(({ question, reponse }) => (
              <div key={question}>
                <dt className="text-corps-fort text-encre">{question}</dt>
                <dd className="m-0 mt-0.5 text-corps text-attenue">{texteRiche(reponse)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      {suivant !== undefined && (
        <Link
          to="/aide/$guide"
          params={{ guide: suivant.id }}
          className={`${CLASSES_CARTE} flex min-h-cible-min items-center justify-between gap-3 p-4 text-encre hover:bg-fond`}
        >
          <span>
            <span className="block text-legende text-attenue">{t('aide.suivant')}</span>
            <span className="block text-corps-fort">{suivant.titre}</span>
          </span>
          <ArrowRight aria-hidden="true" size={20} />
        </Link>
      )}
    </main>
  )
}
