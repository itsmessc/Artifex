const path = require('path');
const fs = require('fs-extra');

const PITCH = `# ForgeJS\n\nIn 2025, starting a new project shouldn't be a chore. ForgeJS is the universal command-line tool that eliminates hours of tedious setup by asking you simple questions and then building a production-ready, full-stack application tailored to your exact specifications.\n\nIt's the npx create-... command you wish you always had.\n\n## The Problem: The \"Setup Tax\"\n\nEvery great idea starts with \`git init\`, followed by a \"setup tax\"—a frustrating ritual of installing dependencies, wrestling with config files, and stitching together a frontend, backend, and database.\n\n- Frontend-only starters are too rigid. What if you want React with Tailwind CSS and Vitest, not their default testing library?\n- Backend setup is a maze of choosing a framework, an ORM, and writing boilerplate for a database connection.\n- Full-stack integration means manually creating a monorepo, configuring workspaces, and ensuring your frontend and backend can communicate.\n\nThis friction kills momentum and wastes your most valuable resource: the creative energy you have at the start of a project.\n\n## The Solution: Your Personal Stack Architect\n\nForgeJS replaces this manual toil with a fast, interactive conversation. You run one command, answer a few questions, and ForgeJS acts as your expert architect, forging a complete, modern, and cohesive application stack in under two minutes.\n\nIt handles everything:\n\n- Choice of Architecture: simple frontend, standalone backend, or a powerful full-stack monorepo.\n- Best-in-Class Tooling: React/Vue/Svelte (via Vite), Node.js (Express or Fastify), Prisma, TypeScript, ESLint, Prettier, Tailwind, and more.\n- Batteries-Included Development: For full-stack projects, it can generate a \`docker-compose.yml\` so you can spin up your database with a single command: \`docker-compose up\`.\n\n## CSS Options\n\nChoose from CSS, SCSS, SASS (indented), Less, or Tailwind CSS.\n\n## The Vision: Instantaneous Innovation\n\nBy making project setup a trivial, near-instant process, we empower developers to:\n\n- Experiment freely without multi-hour setup.\n- Enforce best practices and consistency for teams.\n- Focus on features instead of boilerplate.\n\nUltimately, ForgeJS aims to be the definitive starting point for any JavaScript project.\n`;

function usageSection(ctx) {
    const pm = ctx.pkg || 'npm';
    const runPrefix = pm === 'npm' ? 'npm run' : pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'bun run';
    const rel = '.';
    if (ctx.arch === 'fullstack') {
        const dbNotes = ctx.db && ctx.db !== 'none' ? `\n### Database\n\n- Start DB (Docker Compose):\n\n  - docker compose up -d\n\n- Env file:\n\n  - .env and .env.example are pre-filled with PORT, NODE_ENV, and DATABASE_URL.\n\n${ctx.orm === 'prisma' ? `- Prisma:\n  - ${runPrefix} prisma:generate\n  - ${runPrefix} prisma:migrate\n  - ${runPrefix} prisma:seed\n` : ''}${ctx.orm === 'mongoose' ? `- Mongoose seed:\n  - ${pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm run'} seed\n` : ''}` : '';
        return `\n## Getting Started\n\n- cd ${rel}\n- ${runPrefix} dev\n\nApps:\n- apps/web: Vite dev server\n- apps/api: Node API server\n${ctx.frontend === 'expo' ? '- apps/mobile: Expo dev server\n' : ''}${dbNotes}`;
    }
    const dbNotesSingle = ctx.arch === 'backend' && ctx.db && ctx.db !== 'none' ? `\n### Database\n\n- Start DB: docker compose up -d\n- Env: .env has PORT, NODE_ENV, DATABASE_URL\n${ctx.orm === 'prisma' ? `- Prisma: ${runPrefix} prisma:generate && ${runPrefix} prisma:migrate && ${runPrefix} prisma:seed\n` : ''}${ctx.orm === 'mongoose' ? `- Seed: ${pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm run'} seed\n` : ''}` : '';
    return `\n## Getting Started\n\n- cd ${rel}\n- ${runPrefix} dev\n${dbNotesSingle}`;
}

async function writeRootReadme(ctx) {
    const file = path.join(ctx.projectRoot, 'README.md');
    const content = `${PITCH}\n${usageSection(ctx)}\n`;
    if (ctx.dryRun) return;
    await fs.outputFile(file, content);
}

module.exports = { writeRootReadme };
