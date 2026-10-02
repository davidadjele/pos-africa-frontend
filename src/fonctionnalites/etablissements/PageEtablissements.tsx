import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EtablissementResume } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { optionsFuseaux, PAYS_PAR_DEFAUT } from '../../partage/referentiel/pays'
import { Alerte } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { EtatVide } from '../../partage/ui/EtatVide'
import { ListePaginee } from '../../partage/ui/ListePaginee'
import { type ColonneTableau } from '../../partage/ui/Tableau'
import { FormulaireEtablissement } from './FormulaireEtablissement'
import { DialogueReglagesRecu } from './DialogueReglagesRecu'
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
  const [reglagesRecu, setReglagesRecu] = useState<EtablissementResume | null>(null)

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
        <span className="flex flex-wrap justify-end gap-2">
          <Bouton
            icone={Receipt}
            aria-label={t('recu.reglages.titre', { nom: e.nom })}
            onClick={() => {
              setReglagesRecu(e)
            }}
          >
            {t('recu.reglages.action')}
          </Bouton>
          <Bouton
            icone={Pencil}
            aria-label={t('etablissements.modifierNomme', { nom: e.nom })}
            onClick={() => {
              ouvrir({ mode: 'modification', etablissement: e })
            }}
          >
            {t('etablissements.modifier')}
          </Bouton>
        </span>
      ),
    })
  }

  const vide = requete.data?.total === 0
  const boutonAjouter = (
    <Bouton
      variante="principal"
      icone={Plus}
      onClick={() => {
        ouvrir({ mode: 'creation' })
      }}
    >
      {t('etablissements.ajouter')}
    </Bouton>
  )
  const etatVide = peutGerer ? (
    <EtatVide
      titre={t('etablissements.vide.titre')}
      phrase={t('etablissements.vide.phrase')}
      action={boutonAjouter}
    />
  ) : (
    <EtatVide
      titre={t('etablissements.vide.titre')}
      phrase={t('etablissements.vide.phraseSansDroit')}
    />
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-titre-page text-encre">{t('etablissements.titre')}</h1>
        {peutGerer && edition === null && requete.data !== undefined && !vide && boutonAjouter}
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

      <ListePaginee
        requete={requete}
        chargement={t('etablissements.chargement')}
        vide={edition === null ? etatVide : null}
        libelle={t('etablissements.tableau')}
        colonnes={colonnes}
        cleLigne={(e) => e.id}
        page={page}
        taille={TAILLE_PAGE}
        surChangerPage={setPage}
      />
      {reglagesRecu !== null && (
        <DialogueReglagesRecu
          etablissement={reglagesRecu}
          pays={moi?.entrepriseCourante?.pays ?? PAYS_PAR_DEFAUT.pays}
          surFermer={() => {
            setReglagesRecu(null)
          }}
          surEnregistre={() => {
            setConfirmation(t('recu.reglages.fait', { nom: reglagesRecu.nom }))
            setReglagesRecu(null)
          }}
        />
      )}
    </div>
  )
}
