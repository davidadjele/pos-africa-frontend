import '@fontsource/barlow-semi-condensed/latin-500.css'
import '@fontsource/barlow-semi-condensed/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import './partage/theme/theme.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BandeauMiseAJour } from './app/BandeauMiseAJour'
import { Fournisseurs } from './app/Fournisseurs'
import { creerRouteur } from './app/routeur'

const racine = document.getElementById('racine')
if (racine === null) throw new Error('Élément #racine absent de index.html.')

createRoot(racine).render(
  <StrictMode>
    <Fournisseurs routeur={creerRouteur()}>
      <BandeauMiseAJour />
    </Fournisseurs>
  </StrictMode>,
)
