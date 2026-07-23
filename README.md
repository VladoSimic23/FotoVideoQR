# fotoVideoQr Monorepo

This repository contains both parts of the project in one place:

- `frontend/app` - Next.js guest + dashboard application
- `backend/studio` - Sanity Studio content backend

## Requirements

- Node.js 20+
- npm 10+
- Sanity account and API token with write access

## Project Setup

Install dependencies for both apps:

```bash
cd frontend/app
npm install

cd ../../backend/studio
npm install
```

## Environment Variables (Frontend)

Create environment file for frontend API routes:

```bash
cd frontend/app
cp .env.local.example .env.local
```

Then set values in `.env.local`:

```env
NEXT_PUBLIC_SANITY_PROJECT_ID=33lo3roy
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_WRITE_TOKEN=your_write_token
```

## Run Locally

Run frontend:

```bash
cd frontend/app
npm run dev
```

Run Sanity Studio (separate terminal):

```bash
cd backend/studio
npm run dev
```

- Frontend: http://localhost:3000
- Sanity Studio: http://localhost:3333

## Build and Lint

Frontend:

```bash
cd frontend/app
npm run lint
npm run build
```

Studio:

```bash
cd backend/studio
npm run build
```

## Push as One GitHub Repo

From repository root:

```bash
git init
git add .
git commit -m "Initial monorepo: frontend + Sanity studio"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

If you previously had separate git histories inside `frontend/app` or `backend/studio`, remove nested `.git` folders first so this root repo tracks everything.
