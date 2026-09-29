import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EtablissementResume } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { optionsFuseaux } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { Pagination, Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { FormulaireEtablissement } from './FormulaireEtablissement'
import { requeteEtablissements, TAILLE_PAGE } from './requetes'

type Edition = { mode: 'creation' } | { mode: 'modification'; etablissement: EtablissementResume }

const LIBELLES_FUSEAUX = new Map(optionsFuseaux().map(({ valeur, libelle }) => [valeur, libelle]))

export function PageEtablissements() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { moi, aLaPermission } = useSession()
  // Reflet de la permission : le backend refuse de toute façon une création sans elle.
  const peutGerer = aLaPermission('ETABLISSEMENT_GERER')
  const [page, setPage] = useState(0)
  const requete = useQuery(requeteEtablissements(page))
  const [edition, setEdition] = useState<Edition | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  function ouvrir(nouvelle: Edition) {
    setConfirmation(null)
    setEdition(nouvelle)
  }

  async function recharger(id: string) {
    await clientRequetes.invalidateQueries({ queryKey: ['etablissements'] })
    const { data } = await requete.refetch()
    return data?.elements.find((etablissement) => etablissement.id === id)
  }

  async function surEnregistre(etablissement: EtablissementResume) {
    setConfirmation(
      edition?.mode === 'creation'
        ? t('etablissements.cree', { nom: etablissement.nom })
        : t('etablissements.modifie', { nom: etablissement.nom }),
    )
    setEdition(null)
    await clientRequetes.invalidateQueries({ queryKey: ['etablissements'] })
  }

  const colonnes: ColonneTableau<EtablissementResume>[] = [
    { cle: 'code', entete: t('etablissements.colonnes.code'), rendu: (e) => e.code },
    {
      cle: 'nom',
      entete: t('etablissements.colonnes.nom'),
      rendu: (e) => (
        <>
          <span className="font-semibold">{e.nom}</span>
          {e.adresse !== undefined && (
            <span className="block text-legende text-attenue">{e.adresse}</span>
          )}
        </>
      ),
    },
    {
      cle: 'ville',
      entete: t('etablissements.colonnes.ville'),
      rendu: (e) => e.ville,
      masqueeSurTelephone: true,
    },
    {
      cle: 'fuseau',
      entete: t('etablissements.colonnes.fuseau'),
      rendu: (e) => LIBELLES_FUSEAUX.get(e.fuseauHoraire) ?? e.fuseauHoraire,
      masqueeSurTelephone: true,
    },
  ]
  if (peutGerer) {
    colonnes.push({
      cle: 'actions',
      entete: t('etablissements.colonnes.actions'),
      rendu: (e) => (
        <Bouton
          icone={Pencil}
          aria-label={t('etablissements.modifierNomme', { nom: e.nom })}
          onClick={() => {
            ouvrir({ mode: 'modification', etablissement: e })
          }}
        >
          {t('etablissements.modifier')}
        </Bouton>
      ),
    })
  }

  const liste = requete.data
  const vide = liste?.total === 0
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-titre-page text-encre">{t('etablissements.titre')}</h1>
        {peutGerer && edition === null && liste !== undefined && !vide && (
          <Bouton
            variante="principal"
            icone={Plus}
            onClick={() => {
              ouvrir({ mode: 'creation' })
            }}
          >
            {t('etablissements.ajouter')}
          </Bouton>
        )}
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}

      {edition !== null && (
        <FormulaireEtablissement
          key={edition.mode === 'creation' ? 'creation' : edition.etablissement.id}
          {...(edition.mode === 'modification' ? { etablissement: edition.etablissement } : {})}
          fuseauParDefaut={moi?.entrepriseCourante?.fuseauHoraire ?? 'Africa/Lome'}
          recharger={recharger}
          surEnregistre={(etablissement) => void surEnregistre(etablissement)}
          surAnnuler={() => {
            setEdition(null)
          }}
        />
      )}

      {requete.isPending && <Chargement texte={t('etablissements.chargement')} />}

      {requete.isError && (
        <AlerteErreur
          erreur={requete.error}
          action={
            <Bouton icone={RotateCw} onClick={() => void requete.refetch()}>
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}

      {vide && edition === null && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            titre={t('etablissements.vide.titre')}
            phrase={
              peutGerer ? t('etablissements.vide.phrase') : t('etablissements.vide.phraseSansDroit')
            }
            {...(peutGerer
              ? {
                  action: (
                    <Bouton
                      variante="principal"
                      icone={Plus}
                      onClick={() => {
                        ouvrir({ mode: 'creation' })
                      }}
                    >
                      {t('etablissements.ajouter')}
                    </Bouton>
                  ),
                }
              : {})}
          />
        </section>
      )}

      {liste !== undefined && !vide && (
        <>
          <Tableau
            libelle={t('etablissements.tableau')}
            colonnes={colonnes}
            lignes={liste.elements}
            cleLigne={(e) => e.id}
          />
          <Pagination
            page={page}
            taille={TAILLE_PAGE}
            total={liste.total}
            surChangerPage={setPage}
          />
        </>
      )}
    </div>
  )
}
