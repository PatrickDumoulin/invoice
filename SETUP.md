# Invoice Genius — Guide de démarrage

## 1. Installer les dépendances

```bash
cd app
npm install
```

## 2. Créer le projet Supabase

1. Va sur https://supabase.com → New project
2. Récupère :
   - `SUPABASE_URL` (Settings → API → Project URL)
   - `anon key` (Settings → API → Project API keys)
   - `service_role key` (gardé en lieu sûr — pour les migrations)

## 3. Configurer les variables d'environnement

Crée le fichier `.env` à la racine du dossier `app/` :

```
VITE_SUPABASE_URL="https://ton-projet.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
```

## 4. Installer la CLI Supabase et pousser les migrations

```bash
npm install -g supabase

# Lier le projet
supabase login
supabase link --project-ref TON_PROJECT_REF

# Pousser les 14 migrations dans l'ordre
supabase db push
```

Ou directement via SQL Editor dans le dashboard Supabase (copier-coller chaque fichier dans `supabase/migrations/` dans l'ordre chronologique).

## 5. Créer les buckets de stockage

Dans Supabase Dashboard → Storage → New bucket :
- `invoices` (Private)
- `tax-documents` (Private)

Les politiques RLS sont déjà incluses dans les migrations.

## 6. Déployer les Edge Functions

```bash
# Configurer les secrets
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."
supabase secrets set SITE_ACCESS_PASSWORD="#gU3d!wF3*vk"

# Déployer les fonctions
supabase functions deploy analyze-invoice --no-verify-jwt
supabase functions deploy verify-site-password --no-verify-jwt
```

> Note : `analyze-invoice` requiert JWT (configuré dans config.toml), mais `verify-site-password` est public.

## 7. Importer les données existantes

### Option A — Dump complet (recommandé)
```bash
# Depuis le dossier claude-code-export/database/
psql "$DATABASE_URL" < full_dump.sql
```

> Le DATABASE_URL se trouve dans Supabase → Settings → Database → Connection string (URI mode).

### Option B — Manuellement via CSV
Import les CSV via Supabase Dashboard → Table Editor → Import CSV.

### Réuploader les fichiers de factures
Les fichiers dans `claude-code-export/invoices/` doivent être uploadés dans le bucket `invoices`.

L'ancien user_id est `c8bc9be8-e38a-4cbf-8da4-8e1631d55349`.
Si ton nouveau user_id est différent, tu devras :
1. Uploader les fichiers sous le nouveau user_id
2. Mettre à jour les file_path en DB :
   ```sql
   UPDATE public.invoices
   SET file_path = REPLACE(file_path, 'ancien_uid', 'nouveau_uid');
   ```

Script bash pour uploader les factures :
```bash
USER_ID="<ton_nouveau_user_id>"
SERVICE_KEY="<service_role_key>"
SUPABASE_URL="https://ton-projet.supabase.co"

for f in ../claude-code-export/invoices/*; do
  curl -X POST "$SUPABASE_URL/storage/v1/object/invoices/$USER_ID/$(basename "$f")" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$f"
done
```

## 8. Assigner le rôle admin

Dans Supabase → Table Editor → `user_roles` → Insert row :
- `user_id` : ton UUID (depuis `auth.users`)
- `role` : `admin`

## 9. Démarrer l'application

```bash
npm run dev
```

L'app démarre sur http://localhost:5173

Mot de passe du site : **#gU3d!wF3*vk**

---

## Structure du projet

```
app/
├── src/
│   ├── components/      # Composants React
│   │   ├── ui/          # shadcn/ui primitifs
│   │   ├── SiteGate     # Protection mot de passe
│   │   ├── AuthGuard    # Protection auth
│   │   ├── InvoiceUploader  # Upload + IA
│   │   ├── InvoiceTable     # Table filtrable
│   │   ├── InvoiceCharts    # Graphiques
│   │   ├── TaxSummary       # Sommaire TPS/TVQ
│   │   ├── InvoiceAudit     # Détection anomalies
│   │   ├── InvoiceReconciliation  # Double vérif
│   │   └── PartnershipStats # Partenariat 50-50
│   ├── pages/           # Pages principales
│   ├── hooks/           # useInvoices, useAssets, useAuth
│   ├── lib/             # supabase client, utils
│   └── types/           # Types TypeScript
├── supabase/
│   ├── functions/       # Edge Functions (Deno)
│   │   ├── analyze-invoice/    # Claude API
│   │   └── verify-site-password/
│   └── migrations/      # 14 migrations SQL
└── SETUP.md
```

## Variables d'environnement (Edge Functions)

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (Claude Haiku pour analyse) |
| `SITE_ACCESS_PASSWORD` | Mot de passe d'accès au site |

## Règles métier importantes

- **Inscription TPS/TVQ** : 1er décembre 2025 — avant cette date, pas de CTI/RTI
- **Partenariat 50-50** : depuis octobre 2025
- **Taux** : TPS 5%, TVQ 9.975%
- **Alias** : AMF Internet Services Limited = Anymail Finder
- **Détection doublons** : SHA-256 + triplet (compagnie, montant, date)
