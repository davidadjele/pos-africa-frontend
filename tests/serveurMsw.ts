import { setupServer } from 'msw/node'

// Aucun gestionnaire par défaut : chaque test déclare les réponses de l'API qu'il attend.
export const serveurMsw = setupServer()
