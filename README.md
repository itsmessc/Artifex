# ForgeJS

In 2025, starting a new project shouldn't be a chore. ForgeJS is the universal command-line tool that eliminates hours of tedious setup by asking you simple questions and then building a production-ready, full-stack application tailored to your exact specifications.

It's the npx create-... command you wish you always had.

## What it does

- Interactive prompts to scaffold:
  - Architecture: frontend, backend, or full-stack monorepo
  - Frontend: React/Vue/Svelte (via Vite) — Angular/Expo planned
  - Backend: Express or Fastify (TypeScript)
  - Database: PostgreSQL, MySQL, or MongoDB with Prisma or Mongoose
  - Styling: CSS, SCSS, SASS (indented), Less, or Tailwind CSS
- Generates Docker Compose for selected DBs
- Wires TypeScript, ESLint, and Prettier

## Quick start

Install dependencies for the CLI:

```powershell
npm install
```

Run the CLI (locally):

```powershell
node .\bin\forgejs.js
```

Or with options:

```powershell
node .\bin\forgejs.js --yes --arch fullstack --frontend react --backend express --db postgres --orm prisma --css tailwind --name my-app --pkg npm
```

## Roadmap

- Angular and Expo templates
- Test runners (Vitest/Jest) options
- E2E templates (Playwright/Cypress)
- More backend choices (NestJS, Hono)
- More CSS frameworks (UnoCSS, Windi)

## License

MIT
