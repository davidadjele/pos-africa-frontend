import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import fr from './fr.json'

export const LANGUES = ['fr', 'en'] as const

export const i18n = i18next.createInstance()

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: 'fr',
  fallbackLng: 'fr',
  supportedLngs: LANGUES,
  // React échappe déjà le texte rendu.
  interpolation: { escapeValue: false },
  initAsync: false,
})
