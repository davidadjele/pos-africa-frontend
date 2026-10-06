import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ChevronUp, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DemandeChoix,
  DemandeGroupeOption,
  GroupeOptionResume,
  ProduitResume,
} from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { Dialogue } from '../../partage/ui/Dialogue'
import { requeteProduitsActifs } from './requetes'

interface ChoixSaisi {
  /** Clé de rendu stable : les choix se réordonnent et se retirent pendant la saisie. */
  cle: string
  /** Choix existant : son identifiant suit la modification, pour que les notes gardent leur lien. */
  id?: string
  nom: string
  prix: string
  produitLieId: string
  cout: string
  /** Le détail « stock et coût » est ouvert sous la ligne. */
  ouvert: boolean
}

const vide = (): ChoixSaisi => ({
  cle: crypto.randomUUID(),
  nom: '',
  prix: '',
  produitLieId: '',
  cout: '',
  ouvert: false,
})

/** La liste finit toujours par une ligne vide : on ajoute un choix en le tapant, sans bouton. */
function avecLigneVide(choix: ChoixSaisi[]): ChoixSaisi[] {
  return choix.at(-1)?.nom.trim() === '' ? choix : [...choix, vide()]
}

/**
 * Créer ou modifier un groupe d'options. L'essentiel se voit d'un coup d'œil (nom, règle, choix et prix en plus) ;
 * le stock et le coût, utiles à la marge, restent repliés sous chaque choix.
 */
export function DialogueGroupeOptions({
  groupe,
  devise,
  surFermer,
  surEnregistre,
}: Readonly<{
  /** Vide pour un nouveau groupe. */
  groupe: GroupeOptionResume | null
  devise: Devise
  surFermer: () => void
  surEnregistre: (groupe: GroupeOptionResume) => void
}>) {
  const { t } = useTranslation()
  const id = useId()
  const produits = useQuery(requeteProduitsActifs)
  const nomsDesChoix = useRef<(HTMLInputElement | null)[]>([])
  const nombre = (montant: number) =>
    formaterMontant({ unitesMineures: montant, devise }, { forme: 'nombre' })
  const [nom, setNom] = useState(groupe?.nom ?? '')
  const [multiple, setMultiple] = useState(groupe?.choixMultiple ?? false)
  const [obligatoire, setObligatoire] = useState(groupe?.obligatoire ?? false)
  const [maximum, setMaximum] = useState(
    groupe?.maximum === undefined ? '' : String(groupe.maximum),
  )
  const [choix, setChoix] = useState<ChoixSaisi[]>(() =>
    avecLigneVide(
      (groupe?.choix ?? []).map((un) => ({
        cle: un.id,
        id: un.id,
        nom: un.nom,
        prix: un.supplement === 0 ? '' : nombre(un.supplement),
        produitLieId: un.produitLieId ?? '',
        cout: un.coutRevient === undefined ? '' : nombre(un.coutRevient),
        ouvert: false,
      })),
    ),
  )
  const [erreurNom, setErreurNom] = useState<string | undefined>()
  const [invalide, setInvalide] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const listeProduits = produits.data?.elements ?? []
  const produitDe = (produitId: string): ProduitResume | undefined =>
    listeProduits.find((produit) => produit.id === produitId)

  function changer(rang: number, champ: Partial<ChoixSaisi>) {
    // Le message d'une saisie refusée ne doit pas rester une fois la saisie corrigée.
    setInvalide(null)
    setChoix(avecLigneVide(choix.map((un, i) => (i === rang ? { ...un, ...champ } : un))))
  }

  function lier(rang: number, produitId: string) {
    const un = choix[rang]
    const produit = produitDe(produitId)
    // Lier un produit reprend son prix de vente seul, tant que le prix en plus n'est pas saisi.
    const prix = un?.prix.trim() === '' && produit !== undefined ? nombre(produit.prix) : un?.prix
    changer(rang, { produitLieId: produitId, ...(prix === undefined ? {} : { prix }) })
  }

  function monter(rang: number) {
    const suivants = [...choix]
    const [un] = suivants.splice(rang, 1)
    if (un !== undefined) suivants.splice(rang - 1, 0, un)
    setChoix(suivants)
  }

  /** Les choix tels que l'API les attend, ou null avec un message si une saisie ne se lit pas. */
  function lireChoix(): DemandeChoix[] | null {
    const lus: DemandeChoix[] = []
    for (const un of choix.filter((ligne) => ligne.nom.trim() !== '')) {
      const supplement = un.prix.trim() === '' ? 0 : lireMontant(un.prix, devise)
      const cout = un.cout.trim() === '' ? undefined : lireMontant(un.cout, devise)
      if (supplement === null || supplement < 0 || cout === null) {
        setInvalide(t('options.formulaire.montantInvalide', { nom: un.nom.trim() }))
        return null
      }
      // Lié à un produit, le choix en prend le coût ; sinon, le coût saisi, s'il y en a un.
      let origineDuCout: Pick<DemandeChoix, 'produitLieId' | 'coutRevient'> = {}
      if (un.produitLieId !== '') origineDuCout = { produitLieId: un.produitLieId }
      else if (cout !== undefined) origineDuCout = { coutRevient: cout }
      lus.push({
        ...(un.id === undefined ? {} : { id: un.id }),
        nom: un.nom.trim(),
        supplement,
        ...origineDuCout,
      })
    }
    if (lus.length === 0) {
      setInvalide(t('options.formulaire.auMoinsUn'))
      return null
    }
    return lus
  }

  async function enregistrer() {
    const nomSaisi = nom.trim()
    setErreurNom(nomSaisi === '' ? t('validation.obligatoire') : undefined)
    setInvalide(null)
    const lus = lireChoix()
    if (nomSaisi === '' || lus === null) return
    const max = Number.parseInt(maximum, 10)
    const corps: DemandeGroupeOption = {
      nom: nomSaisi,
      choixMultiple: multiple,
      obligatoire,
      ...(multiple && Number.isInteger(max) && max > 0 ? { maximum: max } : {}),
      choix: lus,
      ...(groupe === null ? {} : { version: groupe.version }),
    }
    setEnCours(true)
    setErreur(null)
    try {
      surEnregistre(
        await appelerApi<GroupeOptionResume>(
          groupe === null ? '/groupes-options' : `/groupes-options/${groupe.id}`,
          { methode: groupe === null ? 'POST' : 'PUT', corps },
        ),
      )
    } catch (refus) {
      setErreur(refus)
      setEnCours(false)
    }
  }

  /** « Stock : Œuf », « Coût saisi 25 F », ou rien : le résumé replié sous le nom du choix. */
  function resume(un: ChoixSaisi): string | null {
    if (un.produitLieId !== '') {
      return t('options.formulaire.resumeStock', { nom: produitDe(un.produitLieId)?.nom ?? '…' })
    }
    if (un.cout.trim() !== '') return t('options.formulaire.resumeCout', { cout: un.cout.trim() })
    return null
  }

  return (
    <Dialogue
      large
      titre={
        groupe === null
          ? t('options.formulaire.titreCreation')
          : t('options.formulaire.titreModification', { nom: groupe.nom })
      }
      consequence={t('options.formulaire.consequence')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={groupe === null ? t('options.formulaire.creer') : t('commun.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void enregistrer()}
    >
      <ChampSaisie
        libelle={t('options.formulaire.nom')}
        obligatoire
        maxLength={60}
        placeholder={t('options.formulaire.nomExemple')}
        value={nom}
        erreur={erreurNom}
        onChange={(evenement) => {
          setNom(evenement.target.value)
        }}
      />

      <div role="radiogroup" aria-labelledby={`${id}-regle`} className="flex flex-col gap-2">
        <span id={`${id}-regle`} className="text-libelle font-semibold text-encre">
          {t('options.formulaire.leClientChoisit')}
        </span>
        <div className="grid gap-2 sm:grid-cols-2">
          {([false, true] as const).map((plusieurs) => {
            const choisi = multiple === plusieurs
            return (
              <div
                key={String(plusieurs)}
                className={clsx(
                  'flex items-start gap-3 rounded-moyen px-4 py-3',
                  choisi ? 'border-2 border-accent bg-fond' : 'border border-trait bg-surface',
                )}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={choisi}
                  onClick={() => {
                    setMultiple(plusieurs)
                  }}
                  className="flex flex-1 items-start gap-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-rond border-2',
                      choisi ? 'border-accent' : 'border-bordure-controle',
                    )}
                  >
                    {choisi && <span className="size-2.5 rounded-rond bg-accent" />}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-corps-fort text-encre">
                      {t(plusieurs ? 'options.formulaire.plusieurs' : 'options.formulaire.unSeul')}
                    </span>
                    <span className="text-legende text-attenue">
                      {t(
                        plusieurs
                          ? 'options.formulaire.plusieursExemple'
                          : 'options.formulaire.unSeulExemple',
                      )}
                    </span>
                  </span>
                </button>
                {/* Le maximum n'existe que pour plusieurs choix : il vit dans leur carte. */}
                {plusieurs && choisi && (
                  <label className="flex items-center gap-2 self-center text-legende text-attenue">
                    {t('options.formulaire.jusqua')}
                    <input
                      aria-label={t('options.formulaire.auPlus')}
                      inputMode="numeric"
                      placeholder="–"
                      value={maximum}
                      onChange={(evenement) => {
                        setMaximum(evenement.target.value)
                      }}
                      className="chiffres h-10 w-14 rounded-normal border border-bordure-controle bg-surface text-center text-corps text-encre"
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={obligatoire}
        onClick={() => {
          setObligatoire(!obligatoire)
        }}
        className="flex items-center gap-3 self-start text-left"
      >
        <span
          aria-hidden="true"
          className={clsx(
            'relative h-6.5 w-11 shrink-0 rounded-rond transition-colors',
            obligatoire ? 'bg-accent' : 'bg-trait',
          )}
        >
          <span
            className={clsx(
              'absolute top-0.75 size-5 rounded-rond bg-surface',
              obligatoire ? 'right-0.75' : 'left-0.75',
            )}
          />
        </span>
        <span className="flex flex-col">
          <span className="text-corps-fort text-encre">{t('options.formulaire.obligatoire')}</span>
          <span className="text-legende text-attenue">
            {t('options.formulaire.obligatoireAide')}
          </span>
        </span>
      </button>

      <div className="flex flex-col gap-2">
        <span className="text-libelle font-semibold text-encre">
          {t('options.formulaire.choix')}
        </span>
        <div className="overflow-hidden rounded-moyen border border-trait">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1fr)_9rem_14rem_5.5rem] gap-2 bg-fond px-3 py-2 text-legende font-bold uppercase tracking-wide text-attenue sm:grid"
          >
            <span>{t('options.formulaire.colonneNom')}</span>
            <span className="text-right">{t('options.formulaire.colonnePrix')}</span>
            <span>{t('options.formulaire.colonneStock')}</span>
            <span />
          </div>
          {choix.map((un, rang) => {
            const derniere = rang === choix.length - 1
            const texte = resume(un)
            return (
              <div
                key={un.cle}
                role="group"
                aria-label={t('options.formulaire.choixNumero', { numero: rang + 1 })}
                className="flex flex-col gap-2 border-t border-trait px-3 py-2 first-of-type:border-t-0"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_14rem_5.5rem]">
                  <input
                    ref={(element) => {
                      nomsDesChoix.current[rang] = element
                    }}
                    aria-label={t('options.formulaire.nomChoix')}
                    maxLength={60}
                    placeholder={derniere ? t('options.formulaire.ajouterChoix') : ''}
                    value={un.nom}
                    onChange={(evenement) => {
                      changer(rang, { nom: evenement.target.value })
                    }}
                    onKeyDown={(evenement) => {
                      // Entrée passe au choix suivant, comme dans un tableur.
                      if (evenement.key === 'Enter') {
                        evenement.preventDefault()
                        nomsDesChoix.current[rang + 1]?.focus()
                      }
                    }}
                    className="h-11 min-w-0 rounded-normal border border-bordure-controle bg-surface px-3 text-corps text-encre placeholder:text-attenue"
                  />
                  <label className="flex h-11 items-center gap-1 rounded-normal border border-bordure-controle bg-surface px-3 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent-vif">
                    <span className="text-corps leading-none text-attenue">+</span>
                    <input
                      aria-label={t('options.formulaire.supplement')}
                      inputMode="decimal"
                      placeholder={t('options.formulaire.inclus')}
                      value={un.prix}
                      onChange={(evenement) => {
                        changer(rang, { prix: evenement.target.value })
                      }}
                      className="chiffres min-w-0 flex-1 bg-transparent text-right text-corps text-encre placeholder:text-attenue focus-visible:outline-none"
                    />
                    <span className="text-corps leading-none text-attenue">F</span>
                  </label>
                  {/* Sur téléphone, résumé et actions partagent une ligne ; sur grand écran, chacun a sa colonne. */}
                  <div className="col-span-2 flex items-center justify-between gap-2 sm:contents">
                    <span className="flex flex-col text-legende">
                      {texte !== null && <span className="font-semibold text-encre">{texte}</span>}
                      {!derniere && (
                        <button
                          type="button"
                          aria-expanded={un.ouvert}
                          onClick={() => {
                            changer(rang, { ouvert: !un.ouvert })
                          }}
                          className="self-start text-encre underline underline-offset-2"
                        >
                          {texte === null
                            ? t('options.formulaire.lierAuStock')
                            : t('options.formulaire.modifierStock')}
                        </button>
                      )}
                    </span>
                    {!derniere && (
                      <span className="flex justify-end gap-1">
                        <button
                          type="button"
                          aria-label={t('options.formulaire.monterNomme', { nom: un.nom })}
                          disabled={rang === 0}
                          onClick={() => {
                            monter(rang)
                          }}
                          className="flex size-10 items-center justify-center rounded-normal text-attenue hover:bg-fond disabled:opacity-30"
                        >
                          <ChevronUp aria-hidden="true" size={18} />
                        </button>
                        <button
                          type="button"
                          aria-label={t('options.formulaire.retirerNomme', { nom: un.nom })}
                          onClick={() => {
                            setChoix(avecLigneVide(choix.filter((_, i) => i !== rang)))
                          }}
                          className="flex size-10 items-center justify-center rounded-normal text-attenue hover:bg-fond"
                        >
                          <X aria-hidden="true" size={18} />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                {un.ouvert && (
                  <div className="flex flex-col gap-2 rounded-normal border border-trait bg-fond p-3">
                    {/* Deux champs au même niveau : l'explication commune passe dessous, pas sous l'un d'eux. */}
                    <div className="grid items-start gap-3 sm:grid-cols-2">
                      <ChampSelection
                        libelle={t('options.formulaire.produitLie')}
                        value={un.produitLieId}
                        options={[
                          { valeur: '', libelle: t('options.formulaire.aucunProduit') },
                          ...listeProduits.map((produit) => ({
                            valeur: produit.id,
                            libelle: produit.nom,
                          })),
                        ]}
                        onChange={(evenement) => {
                          lier(rang, evenement.target.value)
                        }}
                      />
                      {un.produitLieId === '' && (
                        <ChampSaisie
                          libelle={t('options.formulaire.cout')}
                          inputMode="decimal"
                          className="chiffres"
                          suffixe="F"
                          value={un.cout}
                          onChange={(evenement) => {
                            changer(rang, { cout: evenement.target.value })
                          }}
                        />
                      )}
                    </div>
                    <p className="m-0 text-legende text-attenue">
                      {un.produitLieId === ''
                        ? t('options.formulaire.coutAide')
                        : t('options.formulaire.lieExplication', {
                            nom: produitDe(un.produitLieId)?.nom ?? '…',
                          })}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <span className="text-legende text-attenue">{t('options.formulaire.aideBas')}</span>
      </div>
      {invalide !== null && <Alerte ton="danger">{invalide}</Alerte>}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}
