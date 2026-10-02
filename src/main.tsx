import '@fontsource/barlow-semi-condensed/latin-500.css'
import '@fontsource/barlow-semi-condensed/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import './partage/theme/theme.css'
import './partage/impression/impression.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BandeauMiseAJour } from './app/BandeauMiseAJour'
import { creerClientRequetes } from './app/clientRequetes'
import { Fournisseurs } from './app/Fournisseurs'
import { creerRouteur } from './app/routeur'

const racine = document.getElementById('racine')
if (racine === null) throw new Error('Élément #racine absent de index.html.')

const clientRequetes = creerClientRequetes()

createRoot(racine).render(
  <StrictMode>
    <Fournisseurs routeur={creerRouteur({ clientRequetes })} clientRequetes={clientRequetes}>
      <BandeauMiseAJour />
    </Fournisseurs>
  </StrictMode>,
)
