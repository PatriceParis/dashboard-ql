# Dashboard LinkedIn Quarkslab

Reporting des campagnes LinkedIn Ads et de la page LinkedIn de Quarkslab. Site Next.js pré-rendu : les données sont lues dans l'API LinkedIn Marketing au moment du build (`scripts/fetch-linkedin-data.ts`), écrites dans `data/` puis servies en pages statiques. Pas de base de données ni de backend.

## Pages

- `/` : indicateurs sur une période au choix (comparés à la période précédente), diffusion jour par jour, campagnes, publicités les plus cliquées.
- `/publicites` : galerie des publicités au format LinkedIn (Thought Leader Ads compris), taux de clic sur 90 jours, liens des publications sponsorisées à copier.
- `/entreprises` : entreprises touchées sur 7, 30 ou 90 jours, segments inspirés du rapport Entreprises de Campaign Manager (fortement engagées, prospects, grandes entreprises, nouvelles...), filtre par campagne, export CSV, profil de l'audience.
- `/page-linkedin` : abonnés, visites, impressions et interactions des publications de la page, répartition des abonnés, dernières publications.

## Mise en route

```bash
npm install
cp .env.example .env.local   # renseigner LINKEDIN_CLIENT_ID et LINKEDIN_CLIENT_SECRET
npm run auth                 # autorisation OAuth dans le navigateur (callback http://localhost:3000/callback)
npm run fetch-data           # lecture de l'API LinkedIn → data/*.json
npm run dev
```

Scopes demandés : `r_ads r_ads_reporting r_organization_social r_organization_admin r_basicprofile`. Les statistiques de page exigent `r_organization_admin` et un jeton d'un administrateur de la page.

## Déploiement

Vercel (plan Hobby, repo public). Variables à déclarer dans le projet Vercel : `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_REFRESH_TOKEN`, `LINKEDIN_TOKEN_EXPIRES_AT`, `LINKEDIN_AD_ACCOUNT_ID`, `LINKEDIN_ORG_ID`. La commande `vercel-build` enchaîne `fetch-data` puis `build` ; si l'API est injoignable, le site se construit avec les données disponibles.

Le jeton d'accès expire au bout de deux mois : `npm run refresh-token`, puis reporter `LINKEDIN_ACCESS_TOKEN` dans Vercel et redéployer.

Les données se rafraîchissent chaque jour à 6 h 30, heure de Paris : la tâche GitHub Actions `.github/workflows/rafraichissement-quotidien.yml` appelle un Deploy Hook Vercel (secret du dépôt `VERCEL_DEPLOY_HOOK`), et le déploiement relance `fetch-data`. Lancement manuel : onglet Actions, « Rafraichissement quotidien », Run workflow.

## Thought Leader Ads

Les posts sponsorisés publiés depuis un profil personnel ne sont pas toujours lisibles par l'API. Le pipeline les retrouve via la liste des posts de l'auteur ; ce qu'il apprend est enregistré dans `tla-authors.json` (à committer). À défaut, déposer le visuel dans `public/tla/<creativeId>.jpg` ou compléter `tla-authors.json`.
