# Neon + Vercel setup checklist

## A. Create the Neon database
1. Open Neon and create a new project.
2. Create or reuse the default database.
3. Copy the connection string.
4. Put it in `.env` as:

```env
DATABASE_URL="postgresql://..."
```

## B. Create the local environment file
Create `.env` from `.env.example`.

Also add a strong auth secret:

```env
AUTH_SECRET="replace-with-a-random-32-plus-character-secret"
```

## C. Create the tables in Neon
Preferred:

```bash
npm run db:push
```

Optional migration flow:

```bash
npm run db:migrate -- --name init
```

Optional manual SQL fallback:
- Run `docs/neon-manual-schema.sql` inside Neon SQL Editor.

## D. Seed data

```bash
npm run db:seed
```

This seeds:
- master food table rows
- one admin if seed env values are present
- one sample patient if seed env values are present

## E. Run locally

```bash
npm run dev
```

## F. Deploy to Vercel
1. Push code to GitHub.
2. Import repository into Vercel.
3. Add the same env vars from `.env` to Vercel project settings.
4. Deploy.

## G. First production login
Use the seeded admin email and PIN, then:
1. open Admin tab
2. create patient accounts
3. add food items if needed
4. reset seed PINs
