import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, RotateCcw, RotateCw, ShieldCheck, ShieldOff, UserX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type { MembreAjoute, MembrePlateforme } from '../../partage/api/contrat'
import { formaterDate, formaterDateHeure } from '../../partage/dates/formaterDate'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { CodeSecret } from '../../partage/ui/CodeSecret'
import { Dialogue } from '../../partage/ui/Dialogue'
import { MenuActions, type ActionMenu } from '../../partage/ui/MenuActions'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { DialogueMotDePasse } from './DialoguesEntreprise'
import { FUSEAU_APPAREIL, requeteEquipe } from './requetes'

type Ouvert =
  | { type: 'ajout' }
  | { type: 'ajoute'; resultat: MembreAjoute }
  | { type: 'desactivation'; membre: MembrePlateforme }
  | { type: 'motDePasse'; membre: MembrePlateforme }
  | { type: 'role'; membre: MembrePlateforme; role: MembrePlateforme['role'] }
  | null

const nomDe = (membre: Pick<MembrePlateforme, 'prenom' | 'nom'>) =>
  `${membre.prenom} ${membre.nom}`.trim()

/**
 * L'équipe plateforme : seul un responsable la gère, et un responsable n'est jamais désactivé ni réinitialisé
 * d'ici. Le serveur l'impose ; l'écran masque seulement ce qui serait refusé. On ne supprime jamais, on désactive.
 */
export function PageEquipe() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const equipe = useQuery(requeteEquipe())
  const responsable = equipe.data?.find((membre) => membre.vous)?.role === 'RESPONSABLE'
  const [ouvert, setOuvert] = useState<Ouvert>(null)
  const [erreurAction, setErreurAction] = useState<unknown>(null)

  function rafraichir() {
    void clientRequetes.invalidateQueries({ queryKey: requeteEquipe().queryKey })
  }

  async function agir(
    membre: MembrePlateforme,
    action: 'desactivation' | 'reactivation' | 'role',
    corps?: { role: MembrePlateforme['role'] },
  ) {
    setErreurAction(null)
    try {
      await appelerApi(`/plateforme/equipe/${membre.compteId}/${action}`, {
        methode: 'POST',
        ...(corps === undefined ? {} : { corps }),
      })
      setOuvert(null)
      rafraichir()
    } catch (echec) {
      setErreurAction(echec)
    }
  }

  /** Un responsable ne propose que le retrait de son rôle : ni désactivation, ni mot de passe. */
  function actionsDe(m: MembrePlateforme): ActionMenu[] {
    if (m.role === 'RESPONSABLE')
      return [
        {
          libelle: t('plateforme.equipe.retirerRole'),
          icone: ShieldOff,
          surChoisir: () => {
            setErreurAction(null)
            setOuvert({ type: 'role', membre: m, role: 'MEMBRE' })
          },
        },
      ]
    if (!m.actif)
      return [
        {
          libelle: t('plateforme.equipe.reactiver'),
          icone: RotateCcw,
          surChoisir: () => void agir(m, 'reactivation'),
        },
      ]
    return [
      {
        libelle: t('plateforme.equipe.nommerResponsable'),
        icone: ShieldCheck,
        surChoisir: () => {
          setErreurAction(null)
          setOuvert({ type: 'role', membre: m, role: 'RESPONSABLE' })
        },
      },
      {
        libelle: t('plateforme.equipe.redonnerMotDePasse'),
        icone: KeyRound,
        surChoisir: () => {
          setOuvert({ type: 'motDePasse', membre: m })
        },
      },
      {
        libelle: t('plateforme.equipe.desactiver'),
        icone: UserX,
        ton: 'danger',
        surChoisir: () => {
          setErreurAction(null)
          setOuvert({ type: 'desactivation', membre: m })
        },
      },
    ]
  }

  const colonnes: ColonneTableau<MembrePlateforme>[] = [
    {
      cle: 'nom',
      entete: t('plateforme.equipe.colonnes.nom'),
      rendu: (m) => (
        <>
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="font-semibold">{nomDe(m)}</span>
            {m.role === 'RESPONSABLE' && (
              <BadgeStatut ton="info">{t('plateforme.equipe.responsable')}</BadgeStatut>
            )}
            {m.vous && (
              <span className="text-legende text-attenue">{t('plateforme.equipe.vous')}</span>
            )}
          </span>
          {/* Qui l'a ajouté, sous le nom : une colonne de plus pousserait les actions hors du tableau. */}
          <span className="block text-legende text-attenue">
            {m.ajoutePar === undefined
              ? t('plateforme.equipe.premier')
              : t('plateforme.equipe.ajoutePar', {
                  date: formaterDate(m.ajouteLe, FUSEAU_APPAREIL),
                  nom: m.ajoutePar,
                })}
          </span>
        </>
      ),
    },
    { cle: 'email', entete: t('plateforme.equipe.colonnes.email'), rendu: (m) => m.email },
    {
      cle: 'statut',
      entete: t('plateforme.equipe.colonnes.statut'),
      rendu: (m) => {
        if (!m.actif)
          return <BadgeStatut ton="neutre">{t('plateforme.equipe.desactive')}</BadgeStatut>
        if (m.motDePasseAChanger)
          return <BadgeStatut ton="alerte">{t('plateforme.equipe.motDePasseAChoisir')}</BadgeStatut>
        return <BadgeStatut ton="succes">{t('plateforme.equipe.actif')}</BadgeStatut>
      },
    },
    {
      cle: 'connexion',
      entete: t('plateforme.equipe.colonnes.connexion'),
      masqueeSurTelephone: true,
      rendu: (m) =>
        m.derniereConnexionLe === undefined ? (
          <span className="text-attenue">{t('plateforme.fiche.jamais')}</span>
        ) : (
          formaterDateHeure(m.derniereConnexionLe, FUSEAU_APPAREIL)
        ),
    },
    {
      cle: 'actions',
      entete: t('plateforme.equipe.colonnes.actions'),
      rendu: (m) =>
        !responsable || m.vous ? null : (
          <MenuActions
            libelle={t('plateforme.equipe.actionsNomme', { nom: nomDe(m) })}
            actions={actionsDe(m)}
          />
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-titre-page text-encre">{t('plateforme.equipe.titre')}</h1>
          <p className="m-0 mt-1 text-legende text-attenue">{t('plateforme.equipe.phrase')}</p>
        </div>
        {responsable && (
          <Bouton
            variante="principal"
            icone={Plus}
            onClick={() => {
              setOuvert({ type: 'ajout' })
            }}
          >
            {t('plateforme.equipe.ajouter')}
          </Bouton>
        )}
      </div>

      {equipe.isPending && <Chargement texte={t('plateforme.equipe.chargement')} />}
      {equipe.isError && (
        <AlerteErreur
          erreur={equipe.error}
          action={
            <Bouton icone={RotateCw} onClick={() => void equipe.refetch()}>
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {ouvert === null && erreurAction !== null && <AlerteErreur erreur={erreurAction} />}
      {equipe.data !== undefined && (
        <Tableau
          libelle={t('plateforme.equipe.tableau')}
          colonnes={colonnes}
          lignes={equipe.data}
          cleLigne={(m) => m.compteId}
        />
      )}
      <p className="m-0 text-legende text-attenue">
        {t(responsable ? 'plateforme.equipe.regle' : 'plateforme.equipe.regleMembre')}
      </p>

      {ouvert?.type === 'ajout' && (
        <DialogueAjoutMembre
          surFermer={() => {
            setOuvert(null)
          }}
          surAjoute={(resultat) => {
            setOuvert({ type: 'ajoute', resultat })
            rafraichir()
          }}
        />
      )}
      {ouvert?.type === 'ajoute' && (
        <Dialogue
          titre={t('plateforme.fiche.motDePasse.secretTitre', {
            nom: nomDe(ouvert.resultat.membre),
          })}
          consequence={t('plateforme.equipe.secretPhrase')}
          libelleConfirmer={t('plateforme.fiche.motDePasse.transmis')}
          surConfirmer={() => {
            setOuvert(null)
          }}
        >
          <CodeSecret
            libelle={t('plateforme.fiche.motDePasse.secretLibelle')}
            code={ouvert.resultat.motDePasseTemporaire}
          />
          <p className="m-0 text-legende text-attenue">
            {t('personnel.codes.identifiant', { identifiant: ouvert.resultat.membre.email })}
          </p>
        </Dialogue>
      )}
      {ouvert?.type === 'desactivation' && (
        <Dialogue
          titre={t('plateforme.equipe.desactivation.titre', { nom: nomDe(ouvert.membre) })}
          consequence={t('plateforme.equipe.desactivation.consequence')}
          libelleAnnuler={t('commun.annuler')}
          libelleConfirmer={t('plateforme.equipe.desactivation.confirmer')}
          tonConfirmation="danger"
          surAnnuler={() => {
            setOuvert(null)
          }}
          surConfirmer={() => void agir(ouvert.membre, 'desactivation')}
        >
          {erreurAction !== null && <AlerteErreur erreur={erreurAction} />}
        </Dialogue>
      )}
      {ouvert?.type === 'role' && (
        <Dialogue
          titre={t(`plateforme.equipe.role.${ouvert.role}.titre`, { nom: nomDe(ouvert.membre) })}
          consequence={t(`plateforme.equipe.role.${ouvert.role}.consequence`)}
          libelleAnnuler={t('commun.annuler')}
          libelleConfirmer={t(`plateforme.equipe.role.${ouvert.role}.confirmer`)}
          surAnnuler={() => {
            setOuvert(null)
          }}
          surConfirmer={() => void agir(ouvert.membre, 'role', { role: ouvert.role })}
        >
          {erreurAction !== null && <AlerteErreur erreur={erreurAction} />}
        </Dialogue>
      )}
      {ouvert?.type === 'motDePasse' && (
        <DialogueMotDePasse
          nom={nomDe(ouvert.membre)}
          chemin={`/plateforme/equipe/${ouvert.membre.compteId}/mot-de-passe`}
          consequences={[
            t('plateforme.fiche.motDePasse.consequenceSessions'),
            t('plateforme.fiche.motDePasse.consequenceTrace'),
          ]}
          surFermer={() => {
            setOuvert(null)
            rafraichir()
          }}
        />
      )}
    </div>
  )
}

function DialogueAjoutMembre({
  surFermer,
  surAjoute,
}: Readonly<{ surFermer: () => void; surAjoute: (resultat: MembreAjoute) => void }>) {
  const { t } = useTranslation()
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [essaye, setEssaye] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const manques = {
    prenom: prenom.trim() === '',
    nom: nom.trim() === '',
    email: email.trim() === '',
  }
  const erreurEmail =
    erreur instanceof ErreurApi
      ? erreur.reponse.champs?.find((champ) => champ.champ === 'email')?.message
      : undefined

  async function ajouter() {
    setEssaye(true)
    if (manques.prenom || manques.nom || manques.email) return
    setEnCours(true)
    setErreur(null)
    try {
      surAjoute(
        await appelerApi<MembreAjoute>('/plateforme/equipe', {
          methode: 'POST',
          corps: { prenom: prenom.trim(), nom: nom.trim(), email: email.trim() },
        }),
      )
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  const manquant = (champ: keyof typeof manques) =>
    essaye && manques[champ] ? t('plateforme.equipe.ajout.manquant') : undefined

  return (
    <Dialogue
      titre={t('plateforme.equipe.ajout.titre')}
      consequence={t('plateforme.equipe.ajout.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('plateforme.equipe.ajout.confirmer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void ajouter()}
    >
      {erreur !== null && erreurEmail === undefined && <AlerteErreur erreur={erreur} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <ChampSaisie
          libelle={t('plateforme.equipe.ajout.prenom')}
          obligatoire
          maxLength={100}
          value={prenom}
          erreur={manquant('prenom')}
          onChange={(evenement) => {
            setPrenom(evenement.target.value)
          }}
        />
        <ChampSaisie
          libelle={t('plateforme.equipe.ajout.nom')}
          obligatoire
          maxLength={100}
          value={nom}
          erreur={manquant('nom')}
          onChange={(evenement) => {
            setNom(evenement.target.value)
          }}
        />
      </div>
      <ChampSaisie
        libelle={t('plateforme.equipe.ajout.email')}
        obligatoire
        type="email"
        autoComplete="off"
        maxLength={254}
        value={email}
        aide={t('plateforme.equipe.ajout.emailAide')}
        erreur={manquant('email') ?? erreurEmail}
        onChange={(evenement) => {
          setEmail(evenement.target.value)
        }}
      />
    </Dialogue>
  )
}
