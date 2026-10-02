import { useTranslation } from 'react-i18next'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'

/** « Juste », « −600 » en rouge, « +500 » en ambre : le sens de l'écart se lit d'un coup d'œil. */
export function BadgeEcart({
  ecart,
  nombre,
}: Readonly<{ ecart: number; nombre: (valeur: number) => string }>) {
  const { t } = useTranslation()
  if (ecart === 0) return <BadgeStatut ton="succes">{t('rapports.caisses.juste')}</BadgeStatut>
  return (
    <BadgeStatut ton={ecart < 0 ? 'danger' : 'alerte'}>
      {`${ecart < 0 ? '−' : '+'}${nombre(Math.abs(ecart))}`}
    </BadgeStatut>
  )
}
