import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { ProduitResume } from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Dialogue } from '../../partage/ui/Dialogue'
import { requeteProduit } from './requetes'

type Variante = ProduitResume['variantes'][number]

/**
 * Les variantes d'un produit (« Demi », « Entier ») : chacune a son prix, son coût et son stock. En caisse, une
 * seule tuile ; un toucher fait choisir la variante.
 */
export function SectionVariantesProduit({
  produit,
  devise,
}: Readonly<{ produit: ProduitResume; devise: Devise }>) {
  const { t } = useTranslation()
  const id = useId()
  const clientRequetes = useQueryClient()
  const [libelle, setLibelle] = useState('')
  const [prix, setPrix] = useState('')
  const [cout, setCout] = useState('')
  const [invalide, setInvalide] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [aModifier, setAModifier] = useState<Variante | null>(null)
  const montant = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })

  function retenir(frais: ProduitResume) {
    clientRequetes.setQueryData(requeteProduit(produit.id).queryKey, frais)
    void clientRequetes.invalidateQueries({ queryKey: ['catalogue', 'produits'] })
  }

  async function ajouter() {
    const prixLu = lireMontant(prix, devise)
    const coutLu = cout.trim() === '' ? undefined : lireMontant(cout, devise)
    if (libelle.trim() === '' || prixLu === null || prixLu <= 0 || coutLu === null) {
      setInvalide(t('variantes.invalide'))
      return
    }
    setInvalide(null)
    setErreur(null)
    setEnCours(true)
    try {
      retenir(
        await appelerApi<ProduitResume>(`/produits/${produit.id}/variantes`, {
          methode: 'POST',
          corps: {
            libelle: libelle.trim(),
            prix: prixLu,
            ...(coutLu === undefined ? {} : { coutRevient: coutLu }),
          },
        }),
      )
      setLibelle('')
      setPrix('')
      setCout('')
    } catch (refus) {
      setErreur(refus)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section
      aria-labelledby={`${id}-titre`}
      className="flex flex-col gap-3 rounded-moyen border border-trait bg-surface p-4 md:p-6"
    >
      <div>
        <h2 id={`${id}-titre`} className="m-0 text-titre-carte text-encre">
          {t('variantes.titre')}
        </h2>
        <p className="m-0 mt-1 text-legende text-attenue">{t('variantes.phrase')}</p>
      </div>
      {produit.variantes.length > 0 && (
        <table className="w-full border-collapse text-corps">
          <thead>
            <tr className="text-left text-legende font-bold uppercase tracking-wide text-attenue">
              <th className="py-2 font-bold">{t('variantes.colonnes.variante')}</th>
              <th className="py-2 text-right font-bold">{t('variantes.colonnes.prix')}</th>
              <th className="hidden py-2 text-right font-bold sm:table-cell">
                {t('variantes.colonnes.cout')}
              </th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {produit.variantes.map((variante) => (
              <tr key={variante.id} className="border-t border-trait">
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-encre">{variante.libelle}</span>
                    {!variante.actif && (
                      <BadgeStatut ton="neutre">{t('variantes.desactivee')}</BadgeStatut>
                    )}
                  </span>
                </td>
                <td className="chiffres py-2 text-right">{montant(variante.prix)}</td>
                <td className="chiffres hidden py-2 text-right text-attenue sm:table-cell">
                  {variante.coutRevient === undefined ? '–' : montant(variante.coutRevient)}
                </td>
                <td className="py-2 text-right">
                  <Bouton
                    icone={Pencil}
                    aria-label={t('variantes.modifierNomme', { nom: variante.libelle })}
                    onClick={() => {
                      setAModifier(variante)
                    }}
                  >
                    {t('variantes.modifier')}
                  </Bouton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form
        noValidate
        onSubmit={(evenement) => {
          evenement.preventDefault()
          void ajouter()
        }}
        className="grid items-end gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <ChampSaisie
          libelle={t('variantes.nouvelle')}
          maxLength={40}
          placeholder={t('variantes.exemple')}
          value={libelle}
          onChange={(evenement) => {
            setLibelle(evenement.target.value)
          }}
        />
        <ChampSaisie
          libelle={t('variantes.prix')}
          inputMode="decimal"
          className="chiffres"
          suffixe="F"
          value={prix}
          onChange={(evenement) => {
            setPrix(evenement.target.value)
          }}
        />
        <ChampSaisie
          libelle={t('variantes.cout')}
          inputMode="decimal"
          className="chiffres"
          suffixe="F"
          value={cout}
          onChange={(evenement) => {
            setCout(evenement.target.value)
          }}
        />
        <Bouton type="submit" icone={Plus} enCours={enCours}>
          {t('variantes.ajouter')}
        </Bouton>
      </form>
      {invalide !== null && <Alerte ton="danger">{invalide}</Alerte>}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      {aModifier !== null && (
        <DialogueVariante
          produitId={produit.id}
          variante={aModifier}
          devise={devise}
          surFermer={() => {
            setAModifier(null)
          }}
          surEnregistre={(frais) => {
            setAModifier(null)
            retenir(frais)
          }}
        />
      )}
    </section>
  )
}

function DialogueVariante({
  produitId,
  variante,
  devise,
  surFermer,
  surEnregistre,
}: Readonly<{
  produitId: string
  variante: Variante
  devise: Devise
  surFermer: () => void
  surEnregistre: (produit: ProduitResume) => void
}>) {
  const { t } = useTranslation()
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })
  const [libelle, setLibelle] = useState(variante.libelle)
  const [prix, setPrix] = useState(nombre(variante.prix))
  const [cout, setCout] = useState(
    variante.coutRevient === undefined ? '' : nombre(variante.coutRevient),
  )
  const [invalide, setInvalide] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function enregistrer() {
    const prixLu = lireMontant(prix, devise)
    const coutLu = cout.trim() === '' ? undefined : lireMontant(cout, devise)
    if (libelle.trim() === '' || prixLu === null || prixLu <= 0 || coutLu === null) {
      setInvalide(t('variantes.invalide'))
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      surEnregistre(
        await appelerApi<ProduitResume>(`/produits/${produitId}/variantes/${variante.id}`, {
          methode: 'PUT',
          corps: {
            libelle: libelle.trim(),
            prix: prixLu,
            ...(coutLu === undefined ? {} : { coutRevient: coutLu }),
            version: variante.version,
          },
        }),
      )
    } catch (refus) {
      setErreur(refus)
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={t('variantes.titreModification', { nom: variante.libelle })}
      consequence={t('variantes.consequence')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('commun.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void enregistrer()}
    >
      <ChampSaisie
        libelle={t('variantes.libelle')}
        maxLength={40}
        value={libelle}
        onChange={(evenement) => {
          setLibelle(evenement.target.value)
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <ChampSaisie
          libelle={t('variantes.prixTtc')}
          inputMode="decimal"
          className="chiffres"
          suffixe="F"
          value={prix}
          onChange={(evenement) => {
            setPrix(evenement.target.value)
          }}
        />
        <ChampSaisie
          libelle={t('variantes.coutRevient')}
          inputMode="decimal"
          className="chiffres"
          suffixe="F"
          value={cout}
          onChange={(evenement) => {
            setCout(evenement.target.value)
          }}
        />
      </div>
      {invalide !== null && <Alerte ton="danger">{invalide}</Alerte>}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}
