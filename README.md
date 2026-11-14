# Terrain · Administration
Application web pour ordinateur, branchée sur le MÊME projet Supabase que l'app des techniciens.
1. Supabase > SQL Editor : lancer `supabase/006_admin_app.sql` (après 001 à 005).
2. `cp .env.example .env` puis renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (clé publishable).
3. `npm install` puis `npm run dev`.
4. Se connecter avec un compte dont le rôle est « admin ».
Tests : `npm test` (CSV/import). Build : `npm run build`.
# terrain-admine

## Déploiement sur GitHub Pages

Le déploiement est lancé automatiquement à chaque push sur `main` (ou manuellement depuis l'onglet **Actions**).

1. Dans **Settings > Secrets and variables > Actions**, ajoutez les secrets `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` avec les valeurs de votre projet Supabase.
2. Dans **Settings > Pages**, choisissez **GitHub Actions** comme source de publication.
3. Après la réussite du workflow, le site sera disponible à l'adresse `https://zinoww.github.io/terrain-admine/`.

Le site s'authentifie directement auprès de Supabase dans le navigateur : utilisez uniquement la clé publishable/anon, jamais une clé `service_role`. Assurez-vous que les règles RLS Supabase protègent les données et autorisez l'URL GitHub Pages dans les réglages d'authentification Supabase si nécessaire.
