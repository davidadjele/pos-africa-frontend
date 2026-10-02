import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Plus, UserX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { EmployeResume, ResultatEmploye } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { CodeSecret } from '../../partage/ui/CodeSecret'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions } from '../../partage/ui/MenuActions'
import { ListePaginee } from '../../partage/ui/ListePaginee'
import { type ColonneTableau } from '../../partage/ui/Tableau'
import { requeteEtablissements } from '../etablissements/requetes'
import { FormulaireEmploye } from './FormulaireEmploye'
import { requetePersonnel, requeteRoles, TAILLE_PAGE } from './requetes'

type Edition = { mode: 'creation' } | { mode: 'modification'; employe: EmployeResume }

interface Changement {
  action: 'desactivation' | 'pin'
  employe: EmployeResume
}

/** Codes temporaires à montrer une seule fois, puis le message à afficher une fois notés. */
interface Codes {
  titre: string
  pin?: string
  motDePasse?: string
  identifiant?: string
  noter: string
  ensuite?: string
  /** Avertissement : un compte Tonti existant vient d'être rattaché (pas de mot de passe temporaire). */
  compteExistant?: string
}

function nomDe(employe: EmployeResume): string {
  return `${employe.prenom} ${employe.nom}`
}

export function PagePersonnel() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { moi, aLaPermission } = useSession()
  // Reflet de la permission : le serveur applique de toute façon le périmètre de chacun.
  const peutGerer = aLaPermission('PERSONNEL_GERER')
  const [page, setPage] = useState(0)
  const requete = useQuery(requetePersonnel(page))
  const roles = useQuery(requeteRoles)
  const etablissements = useQuery(requeteEtablissements(0))
  const [edition, setEdition] = useState<Edition | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [changement, setChangement] = useState<Changement | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreurChangement, setErreurChangement] = useState<unknown>(null)
  const [codes, setCodes] = useState<Codes | null>(null)

  const nomsEtablissements = new Map(
    (etablissements.data?.elements ?? []).map((etablissement) => [
      etablissement.id,
      etablissement.nom,
    ]),
  )

  function ouvrir(nouvelle: Edition) {
    setConfirmation(null)
    setEdition(nouvelle)
  }

  async function actualiser() {
    await clientRequetes.invalidateQueries({ queryKey: ['personnel'] })
  }

  async function recharger(id: string) {
    await actualiser()
    const { data } = await requete.refetch()
    return data?.elements.find((employe) => employe.id === id)
  }

  function surEnregistre(resultat: ResultatEmploye) {
    const nom = nomDe(resultat.employe)
    const ensuite =
      edition?.mode === 'creation' ? t('personnel.cree', { nom }) : t('personnel.modifie', { nom })
    setEdition(null)
    void actualiser()
    const compteExistant = resultat.compteExistant
      ? t('personnel.codes.compteExistant', {
          nom,
          entreprise: moi?.entrepriseCourante?.nom ?? '',
        })
      : undefined
    if (resultat.pinTemporaire === undefined && resultat.motDePasseTemporaire === undefined) {
      setConfirmation(compteExistant === undefined ? ensuite : `${ensuite} ${compteExistant}`)
      return
    }
    const identifiant = resultat.employe.telephone ?? resultat.employe.email
    setCodes({
      titre: t('personnel.codes.titre', { nom }),
      ...(resultat.pinTemporaire === undefined ? {} : { pin: resultat.pinTemporaire }),
      ...(resultat.motDePasseTemporaire === undefined
        ? {}
        : { motDePasse: resultat.motDePasseTemporaire }),
      ...(identifiant === undefined ? {} : { identifiant }),
      noter: t('personnel.codes.noter'),
      ensuite,
      ...(compteExistant === undefined ? {} : { compteExistant }),
    })
  }

  function demander(action: Changement['action'], employe: EmployeResume) {
    setConfirmation(null)
    setErreurChangement(null)
    setChangement({ action, employe })
  }

  async function confirmer({ action, employe }: Changement) {
    setEnCours(true)
    try {
      const nom = nomDe(employe)
      if (action === 'pin') {
        const resultat = await appelerApi<ResultatEmploye>(`/personnel/${employe.id}/pin`, {
          methode: 'POST',
        })
        setCodes({
          titre: t('personnel.codes.titrePin', { nom }),
          ...(resultat.pinTemporaire === undefined ? {} : { pin: resultat.pinTemporaire }),
          noter: t('personnel.codes.noterPin'),
        })
      } else {
        await appelerApi(`/personnel/${employe.id}/desactivation`, { methode: 'POST' })
        setConfirmation(t('personnel.desactive', { nom }))
      }
      setChangement(null)
      await actualiser()
    } catch (erreur) {
      setErreurChangement(erreur)
    } finally {
      setEnCours(false)
    }
  }

  async function reactiver(employe: EmployeResume) {
    setConfirmation(null)
    try {
      await appelerApi(`/personnel/${employe.id}/reactivation`, { methode: 'POST' })
      setConfirmation(t('personnel.reactive', { nom: nomDe(employe) }))
      await actualiser()
    } catch (erreur) {
      setErreurChangement(erreur)
    }
  }

  const colonnes: ColonneTableau<EmployeResume>[] = [
    {
      cle: 'employe',
      entete: t('personnel.colonnes.employe'),
      rendu: (e) => (
        <>
          <span className="font-semibold">{nomDe(e)}</span>
          <span className="block text-legende text-attenue">
            {e.telephone ?? e.email ?? t('personnel.caisseSeulement')}
          </span>
        </>
      ),
    },
    {
      cle: 'roles',
      entete: t('personnel.colonnes.roles'),
      rendu: (e) => {
        // Un établissement hors de son périmètre n'est pas nommé : on dit seulement qu'il y en a.
        const chargement = etablissements.data === undefined
        const visibles = e.affectations.filter(
          (affectation) =>
            chargement ||
            affectation.etablissementId === undefined ||
            nomsEtablissements.has(affectation.etablissementId),
        )
        const autres = e.affectations.length - visibles.length
        return (
          <ul className="m-0 list-none p-0">
            {visibles.map((affectation) => (
              <li key={`${affectation.etablissementId ?? 'entreprise'}-${affectation.role}`}>
                {t('personnel.roleDans', {
                  lieu:
                    affectation.etablissementId === undefined
                      ? t('personnel.touteLEntreprise')
                      : (nomsEtablissements.get(affectation.etablissementId) ?? '…'),
                  role: t(`roles.${affectation.role}`),
                })}
              </li>
            ))}
            {autres > 0 && (
              <li className="text-legende text-attenue">
                {t('personnel.autresEtablissements', { count: autres })}
              </li>
            )}
          </ul>
        )
      },
    },
    {
      cle: 'acces',
      entete: t('personnel.colonnes.acces'),
      masqueeSurTelephone: true,
      rendu: (e) => (
        <BadgeStatut ton={e.backOffice ? 'info' : 'neutre'}>
          {e.backOffice ? t('personnel.acces.backOffice') : t('personnel.acces.caisse')}
        </BadgeStatut>
      ),
    },
    {
      cle: 'pin',
      entete: t('personnel.colonnes.pin'),
      masqueeSurTelephone: true,
      rendu: (e) =>
        e.actif && (
          <BadgeStatut ton={e.pinAChanger ? 'alerte' : 'neutre'}>
            {e.pinAChanger ? t('personnel.pin.aChanger') : t('personnel.pin.defini')}
          </BadgeStatut>
        ),
    },
    {
      cle: 'statut',
      entete: t('personnel.colonnes.statut'),
      rendu: (e) => (
        <BadgeStatut ton={e.actif ? 'succes' : 'neutre'}>
          {e.actif ? t('personnel.statut.actif') : t('personnel.statut.desactive')}
        </BadgeStatut>
      ),
    },
  ]
  if (peutGerer) {
    colonnes.push({
      cle: 'actions',
      entete: t('personnel.colonnes.actions'),
      rendu: (e) => {
        const nom = nomDe(e)
        const reinitialiserPin = {
          libelle: t('personnel.reinitialiserPin'),
          icone: KeyRound,
          surChoisir: () => {
            demander('pin', e)
          },
        }
        // Employé aussi affecté hors du périmètre : seul son PIN se réinitialise d'ici (déblocage en service).
        if (!e.gerable) {
          return e.actif && e.pinReinitialisable ? (
            <div className="flex justify-end">
              <MenuActions
                libelle={t('personnel.plusDActions', { nom })}
                actions={[reinitialiserPin]}
              />
            </div>
          ) : null
        }
        if (!e.actif) {
          return (
            <Bouton
              aria-label={t('personnel.reactiverNomme', { nom })}
              onClick={() => void reactiver(e)}
            >
              {t('personnel.reactiver')}
            </Bouton>
          )
        }
        return (
          <div className="flex justify-end gap-2">
            <Bouton
              icone={Pencil}
              aria-label={t('personnel.modifierNomme', { nom })}
              onClick={() => {
                ouvrir({ mode: 'modification', employe: e })
              }}
            >
              {t('personnel.modifier')}
            </Bouton>
            <MenuActions
              libelle={t('personnel.plusDActions', { nom })}
              actions={[
                reinitialiserPin,
                {
                  libelle: t('personnel.desactiver'),
                  icone: UserX,
                  ton: 'danger',
                  surChoisir: () => {
                    demander('desactivation', e)
                  },
                },
              ]}
            />
          </div>
        )
      },
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
      {t('personnel.ajouter')}
    </Bouton>
  )
  const referentielsPrets = roles.data !== undefined && etablissements.data !== undefined

  const actionVide = peutGerer && referentielsPrets ? { action: boutonAjouter } : {}
  const etatVide = (
    <EtatVide
      titre={t('personnel.vide.titre')}
      phrase={t('personnel.vide.phrase')}
      {...actionVide}
    />
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-titre-page text-encre">{t('personnel.titre')}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('personnel.phrase')}</p>
        </div>
        {peutGerer && edition === null && referentielsPrets && !vide && boutonAjouter}
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
      {erreurChangement !== null && changement === null && (
        <AlerteErreur erreur={erreurChangement} />
      )}

      {edition !== null && roles.data !== undefined && etablissements.data !== undefined && (
        <FormulaireEmploye
          key={edition.mode === 'creation' ? 'creation' : edition.employe.id}
          {...(edition.mode === 'modification' ? { employe: edition.employe } : {})}
          etablissements={etablissements.data.elements}
          roles={roles.data}
          pays={moi?.entrepriseCourante?.pays ?? 'TG'}
          recharger={recharger}
          surEnregistre={surEnregistre}
          surAnnuler={() => {
            setEdition(null)
          }}
        />
      )}

      <ListePaginee
        requete={requete}
        chargement={t('personnel.chargement')}
        vide={edition === null ? etatVide : null}
        libelle={t('personnel.tableau')}
        colonnes={colonnes}
        cleLigne={(e) => e.id}
        page={page}
        taille={TAILLE_PAGE}
        surChangerPage={setPage}
      />

      {changement !== null && (
        <Dialogue
          titre={
            changement.action === 'pin'
              ? t('personnel.pinConfirmation.titre', { nom: nomDe(changement.employe) })
              : t('personnel.desactivation.titre', { nom: nomDe(changement.employe) })
          }
          consequence={
            changement.action === 'pin'
              ? t('personnel.pinConfirmation.consequence')
              : t('personnel.desactivation.consequence', { nom: nomDe(changement.employe) })
          }
          libelleAnnuler={
            changement.action === 'pin'
              ? t('personnel.pinConfirmation.annuler')
              : t('personnel.desactivation.annuler')
          }
          libelleConfirmer={
            changement.action === 'pin'
              ? t('personnel.pinConfirmation.confirmer')
              : t('personnel.desactivation.confirmer')
          }
          tonConfirmation={changement.action === 'pin' ? 'principal' : 'danger'}
          enCours={enCours}
          surAnnuler={() => {
            setChangement(null)
          }}
          surConfirmer={() => void confirmer(changement)}
        >
          {erreurChangement !== null && <AlerteErreur erreur={erreurChangement} />}
        </Dialogue>
      )}

      {codes !== null && (
        <Dialogue
          titre={codes.titre}
          consequence={t('personnel.codes.consequence')}
          libelleConfirmer={codes.noter}
          surConfirmer={() => {
            if (codes.ensuite !== undefined) setConfirmation(codes.ensuite)
            setCodes(null)
          }}
        >
          {codes.compteExistant !== undefined && <Alerte ton="info">{codes.compteExistant}</Alerte>}
          {codes.pin !== undefined && (
            <CodeSecret libelle={t('personnel.codes.pin')} code={codes.pin} />
          )}
          {codes.motDePasse !== undefined && (
            <div className="flex flex-col gap-1">
              <CodeSecret libelle={t('personnel.codes.motDePasse')} code={codes.motDePasse} />
              {codes.identifiant !== undefined && (
                <p className="m-0 text-legende text-attenue">
                  {t('personnel.codes.identifiant', { identifiant: codes.identifiant })}
                </p>
              )}
            </div>
          )}
          <p className="m-0 text-legende text-attenue">{t('personnel.codes.perdu')}</p>
        </Dialogue>
      )}
    </div>
  )
}
