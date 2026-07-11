# NutriTrack Web

NutriTrack is now structured as a **Next.js + Neon + Vercel** installable web app with two roles:

- **Patient**: logs food intake, stores dated medical updates, exports own data, updates profile targets, signs in with email + 4 digit PIN.
- **Admin**: can create users, view every patient, compare cross-patient metrics, manage the master food table, reset PINs, and export analytics.

## What is already implemented in this repo

- Next.js App Router structure for Vercel deployment
- Prisma schema for a centralized PostgreSQL / Neon database
- JWT cookie session auth with **email + 4 digit PIN**
- `PATIENT` and `ADMIN` roles
- Master food table shared across all users
- Dated medical records table linked to users
- Food log table linked to users and master food items
- Responsive dashboard UI for mobile, tablet, and desktop
- PWA manifest + service worker so it can be installed as an app

## Database design

### 1. `users`
Stores login and profile data.

### 2. `food_items`
Master table with per-100g nutrition values:
- `itemName`
- `carbohydrates`
- `proteins`
- `fats`
- `calories`

### 3. `medical_records`
Stores historical medical data for a user. Every update creates a **new row**.
- `weight`
- `height`
- `bmi`
- `bpLow`
- `bpHigh`
- `date`

### 4. `food_logs`
Stores daily intake rows for a user.
- `dishName`
- `quantityGms`
- calculated nutrition snapshot
- linked `foodItemId`
- linked `userId`

## Local setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create your environment file
Copy `.env.example` to `.env` and fill in real values.

Required variables:
```env
DATABASE_URL="your-neon-connection-string"
AUTH_SECRET="a-long-random-secret"
```

Optional seed values:
```env
SEED_ADMIN_EMAIL="admin@nutritrack.app"
SEED_ADMIN_PIN="1234"
SEED_ADMIN_NAME="Primary Admin"
SEED_PATIENT_EMAIL="patient@nutritrack.app"
SEED_PATIENT_PIN="1234"
SEED_PATIENT_NAME="Sample Patient"
```

### 3. Push the schema to Neon
```bash
npm run db:push
```

If you prefer migrations instead of direct push:
```bash
npm run db:migrate -- --name init
```

### 4. Seed master foods and starter users
```bash
npm run db:seed
```

### 5. Start locally
```bash
npm run dev
```

## Neon database setup

### Recommended approach
1. Create a new project in Neon.
2. Copy the **pooled PostgreSQL connection string**.
3. Paste it into `.env` as `DATABASE_URL`.
4. Run:
   - `npm run db:push`
   - `npm run db:seed`

### Manual SQL alternative
If you want to inspect or manually create the schema in Neon SQL Editor, use:
- `docs/neon-manual-schema.sql`

But the preferred approach is still Prisma.

## Vercel deployment

### Environment variables in Vercel
Add these project environment variables in Vercel:
- `DATABASE_URL`
- `AUTH_SECRET`
- `SEED_ADMIN_EMAIL` (optional)
- `SEED_ADMIN_PIN` (optional)
- `SEED_ADMIN_NAME` (optional)
- `SEED_PATIENT_EMAIL` (optional)
- `SEED_PATIENT_PIN` (optional)
- `SEED_PATIENT_NAME` (optional)

### Deploy flow
1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables above.
4. Deploy.
5. Run Prisma schema push once from your machine against the same Neon DB:
   ```bash
   npm run db:push
   npm run db:seed
   ```

## Important files

- `app/page.tsx` - landing/login screen
- `app/dashboard/page.tsx` - loads dashboard data and admin comparison metrics
- `components/nutritrack-app.tsx` - main responsive patient/admin UI
- `components/login-form.tsx` - email + PIN login form
- `components/install-app-button.tsx` - browser install/PWA button
- `lib/actions.ts` - server actions for login, users, foods, logs, records, PIN reset
- `lib/session.ts` - JWT cookie session handling
- `lib/auth.ts` - route protection helpers
- `lib/validation.ts` - Zod validation schemas
- `lib/prisma.ts` - Neon + Prisma client wiring
- `prisma/schema.prisma` - centralized database schema
- `prisma/seed.mjs` - starter seed for foods/admin/patient
- `public/sw.js` - service worker for installable app support
- `docs/neon-manual-schema.sql` - optional manual SQL

## Notes

- Do not commit the real `.env` file.
- Change default seed PINs before production use.
- Use a strong `AUTH_SECRET` in production.
- The app is intentionally lightweight on authorization: only email + 4 digit PIN, with role-based dashboard access.

