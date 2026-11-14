# Terrain · Administration
Application web pour ordinateur, branchée sur le MÊME projet Supabase que l'app des techniciens.
1. Supabase > SQL Editor : lancer `supabase/006_admin_app.sql` (après 001 à 005).
2. `cp .env.example .env` puis renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (clé publishable).
3. `npm install` puis `npm run dev`.
4. Se connecter avec un compte dont le rôle est « admin ».
Tests : `npm test` (CSV/import). Build : `npm run build`.
# terrain-admine
