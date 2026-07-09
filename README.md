# Sport Tracker — Next.js + Supabase + Vercel

Application mobile de suivi sport, nutrition et sommeil, avec **score de récupération** et **coach IA** (Claude).

## 📁 Structure du projet

```
sport-tracker/
├── app/
│   ├── api/coach/        # route serveur du coach IA (API Claude, streaming)
│   ├── coach/            # page chat du coach
│   ├── dashboard/        # tableau de bord (récup, sport, nutrition, sommeil)
│   ├── log/              # saisie des séances / repas / nuits
│   ├── components/       # RecoveryPanel (jauge + métriques de récupération)
│   ├── globals.css, layout.tsx, page.tsx
├── lib/
│   ├── supabase.ts       # client Supabase + types + zones cardiaques
│   └── recovery.ts       # moteur de récupération (ACWR, dette sommeil, score…)
├── scripts/
│   └── migrate-excel.js  # migration Excel → Supabase
├── supabase/
│   └── schema.sql        # schéma des tables (à exécuter dans Supabase)
├── data/
│   └── suivi_sport_nutrition.xlsx   # données source (déjà migrées)
└── public/               # PWA manifest
```

## 🚀 Déploiement en 4 étapes

### Étape 1 — Supabase

1. Va sur [supabase.com](https://supabase.com) → **New Project**
2. Copie-colle le contenu de `supabase/schema.sql` dans **SQL Editor** → **Run**
3. Récupère dans **Settings → API** :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Étape 2 — Configuration + migration de l'Excel existant

```bash
npm install
cp .env.local.example .env.local
# Remplis .env.local :
#  - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase)
#  - ANTHROPIC_API_KEY (Claude, pour le coach IA — console.anthropic.com)

# Migration (le script ne charge pas .env.local, passe les variables Supabase) :
NEXT_PUBLIC_SUPABASE_URL="..." NEXT_PUBLIC_SUPABASE_ANON_KEY="..." \
  npm run migrate data/suivi_sport_nutrition.xlsx
```

### Étape 3 — Vercel

1. Push ce dossier sur GitHub
2. Va sur [vercel.com](https://vercel.com) → **New Project** → importe ton repo
3. Dans **Environment Variables**, ajoute :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
4. **Deploy** → ton URL est prête

### Étape 4 — Mobile

- Ouvre l'URL Vercel sur ton iPhone
- **Share → Add to Home Screen** pour l'avoir comme une app native

---

## 📱 Fonctionnalités

- **Logger** : saisie sport (FC, kcal, durée, zone cardiaque auto), nutrition (macros), sommeil (durée auto, qualité)
- **Dashboard** : score de récupération (ACWR, dette de sommeil, monotonie…), KPIs et historique par onglet
- **Coach IA** : chat propulsé par Claude qui analyse tes données et te conseille

## 🔧 Dev local

```bash
npm install
npm run dev
# → http://localhost:3000
```
