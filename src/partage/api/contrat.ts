import type { components } from './schema'

// Raccourcis vers les types générés depuis l'OpenAPI du backend (npm run api:generer) :
// aucun type de l'API n'est écrit à la main.
type Schemas = components['schemas']

export type ReponseConnexion = Schemas['ReponseConnexion']
export type ReponseRafraichissement = Schemas['ReponseRafraichissement']
export type ReponseMoi = Schemas['ReponseMoi']
export type EntrepriseAccessible = Schemas['EntrepriseAccessible']
export type ConfigurationPublique = Schemas['ConfigurationPublique']
export type DemandeConnexion = Schemas['DemandeConnexion']
export type DemandeInscription = Schemas['DemandeInscription']
export type DemandeCreationEntreprise = Schemas['DemandeCreationEntreprise']
export type EntrepriseCreee = Schemas['EntrepriseCreee']
export type EntreprisePlateforme = Schemas['EntreprisePlateforme']
export type PageEntreprisesPlateforme = Schemas['PageResultatsEntreprisePlateforme']
export type EtablissementResume = Schemas['EtablissementResume']
export type PageEtablissements = Schemas['PageResultatsEtablissementResume']
export type DemandeEtablissement = Schemas['DemandeEtablissement']
export type DemandeModificationEtablissement = Schemas['DemandeModificationEtablissement']
export type Portee = ReponseMoi['portee']
