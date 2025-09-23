const path = require('path');
const fs = require('fs-extra');
const kleur = require('kleur');

function pkgJSON(ctx) {
    const devDeps = {
        eslint: '^9.11.1',
        'eslint-config-prettier': '^9.1.0',
        prettier: '^3.3.3',
    };
    const deps = {};
    // Always include dotenv to load environment variables from .env
    deps.dotenv = '^16.4.5';
    if (ctx.backend === 'express') {
        deps.express = '^5.1.0';
        if ((ctx.lang || 'ts') === 'ts') devDeps['@types/express'] = '^4.17.21';
    } else {
        deps.fastify = '^5.6.0';
    }
    if (ctx.orm === 'prisma' && ctx.db && ctx.db !== 'none') {
        deps['@prisma/client'] = '^6.16.2';
        devDeps.prisma = '^6.16.2';
    }
    if (ctx.db === 'mongodb' && ctx.orm === 'mongoose') {
        deps.mongoose = '^8.18.1';
    }
    if ((ctx.lang || 'ts') === 'ts') {
        Object.assign(devDeps, {
            typescript: '^5.9.2',
            tsx: '^4.19.2',
            '@types/node': '^24.5.2',
        });
    }
    return {
        name: ctx.name + (ctx.arch === 'fullstack' ? '-api' : ''),
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
            dev: (ctx.lang || 'ts') === 'ts' ? 'tsx watch src/index.ts' : 'node src/index.js',
            build: (ctx.lang || 'ts') === 'ts' ? 'tsc -p tsconfig.json' : 'echo "No build step for JS"',
            start: (ctx.lang || 'ts') === 'ts' ? 'node dist/index.js' : 'node src/index.js',
            lint: 'eslint .',
            format: 'prettier -w .'
        },
        dependencies: deps,
        devDependencies: devDeps
    };
}

function tsconfigJSON() {
    return {
        compilerOptions: {
            target: 'ES2020',
            lib: ['ES2020'],
            module: 'ESNext',
            moduleResolution: 'bundler',
            outDir: 'dist',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            types: ['node']
        },
        include: ['src']
    };
}

function backendCode(ctx) {
    if (ctx.backend === 'express') {
        return (ctx.lang || 'ts') === 'ts'
            ? `import 'dotenv/config'\nimport express from 'express'\nconst app = express()\napp.use(express.json())\nconst port = process.env.PORT || 3000\napp.get('/api/health', (_req, res) => res.json({ ok: true }))\napp.listen(port, () => console.log('API on :' + port))\n`
            : `import 'dotenv/config'\nimport express from 'express'\nconst app = express()\napp.use(express.json())\nconst port = process.env.PORT || 3000\napp.get('/api/health', (req, res) => res.json({ ok: true }))\napp.listen(port, () => console.log('API on :' + port))\n`;
    }
    return (ctx.lang || 'ts') === 'ts'
        ? `import 'dotenv/config'\nimport Fastify from 'fastify'\nconst app = Fastify()\nconst port = Number(process.env.PORT) || 3000\napp.get('/api/health', async () => ({ ok: true }))\napp.listen({ port, host: '0.0.0.0' }).then(() => console.log('API on :' + port))\n`
        : `import 'dotenv/config'\nimport Fastify from 'fastify'\nconst app = Fastify()\nconst port = Number(process.env.PORT) || 3000\napp.get('/api/health', async () => ({ ok: true }))\napp.listen({ port, host: '0.0.0.0' }).then(() => console.log('API on :' + port))\n`;
}

function prismaSchema(ctx) {
    const provider = ctx.db === 'postgres' ? 'postgresql' : ctx.db === 'mysql' ? 'mysql' : ctx.db === 'mongodb' ? 'mongodb' : 'sqlite';
    const url = ctx.db === 'postgres' ? 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/forge?schema=public"'
        : ctx.db === 'mysql' ? 'DATABASE_URL="mysql://root:password@localhost:3306/forge"'
            : ctx.db === 'mongodb' ? 'DATABASE_URL="mongodb://root:password@localhost:27017/forge"'
                : 'DATABASE_URL="file:./dev.db"';
    return { schema: `datasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}\n\ngenerator client {\n  provider = "prisma-client-js"\n}\n\nmodel User {\n  id    String @id @default(cuid())\n  email String @unique\n  name  String?\n}\n`, env: url + '\n' };
}

function mongooseEnv() {
    return 'DATABASE_URL="mongodb://root:password@localhost:27017/forge"\n';
}

function dbUrl(ctx) {
    if (!ctx.db || ctx.db === 'none') return null;
    if (ctx.db === 'postgres') return 'postgresql://postgres:postgres@localhost:5432/forge?schema=public';
    if (ctx.db === 'mysql') return 'mysql://root:password@localhost:3306/forge';
    if (ctx.db === 'mongodb') return 'mongodb://root:password@localhost:27017/forge';
    return null;
}

function backendEnvContent(ctx) {
    const lines = [];
    lines.push('PORT=3000');
    lines.push('NODE_ENV=development');
    const url = dbUrl(ctx);
    if (url) lines.push(`DATABASE_URL="${url}"`);
    return lines.join('\n') + '\n';
}

async function generateBackend(ctx) {
    const root = ctx.root || ctx.projectRoot;
    const srcDir = path.join(root, 'src');
    const isTS = (ctx.lang || 'ts') === 'ts';
    const ext = isTS ? 'ts' : 'js';
    const files = [
        { path: path.join(root, 'package.json'), contents: JSON.stringify(pkgJSON(ctx), null, 2) + '\n' },
        ...(isTS ? [{ path: path.join(root, 'tsconfig.json'), contents: JSON.stringify(tsconfigJSON(), null, 2) + '\n' }] : []),
        { path: path.join(srcDir, `index.${ext}`), contents: backendCode(ctx) },
        { path: path.join(root, '.prettierrc'), contents: JSON.stringify({ semi: true, singleQuote: true, trailingComma: 'all' }, null, 2) + '\n' },
        { path: path.join(root, '.eslintrc.json'), contents: JSON.stringify({ env: { node: true, es2020: true }, extends: ['eslint:recommended', 'prettier'], parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }, ignorePatterns: ['dist/'] }, null, 2) + '\n' },
        { path: path.join(root, '.env'), contents: backendEnvContent(ctx) },
        { path: path.join(root, '.env.example'), contents: backendEnvContent(ctx) },
    ];
    if (ctx.orm === 'prisma' && ctx.db && ctx.db !== 'none') {
        const { schema } = prismaSchema(ctx);
        files.push(
            { path: path.join(root, 'prisma', 'schema.prisma'), contents: schema },
            {
                path: path.join(root, `prisma`, `seed.${isTS ? 'ts' : 'js'}`), contents: isTS
                    ? `import 'dotenv/config'\nimport { PrismaClient } from '@prisma/client'\nconst prisma = new PrismaClient()\nasync function run(){\n  await prisma.user.deleteMany({})\n  await prisma.user.createMany({ data: [{ email: 'alice@example.com', name: 'Alice' }, { email: 'bob@example.com', name: 'Bob' }] })\n  console.log('Seeded')\n}\nrun().finally(()=>prisma.$disconnect())\n`
                    : `import 'dotenv/config'\nimport { PrismaClient } from '@prisma/client'\nconst prisma = new PrismaClient()\nasync function run(){\n  await prisma.user.deleteMany({})\n  await prisma.user.createMany({ data: [{ email: 'alice@example.com', name: 'Alice' }, { email: 'bob@example.com', name: 'Bob' }] })\n  console.log('Seeded')\n}\nrun().finally(()=>prisma.$disconnect())\n`
            }
        );
        // Enhance package.json scripts for Prisma
        const pkgPath = path.join(root, 'package.json');
        const pkgFile = files.find(f => f.path === pkgPath);
        if (pkgFile) {
            const pkgJson = JSON.parse(pkgFile.contents);
            pkgJson.scripts = pkgJson.scripts || {};
            pkgJson.scripts['prisma:generate'] = 'prisma generate';
            pkgJson.scripts['prisma:migrate'] = 'prisma migrate dev';
            pkgJson.scripts['prisma:seed'] = isTS ? 'tsx prisma/seed.ts' : 'node prisma/seed.js';
            pkgFile.contents = JSON.stringify(pkgJson, null, 2) + '\n';
        }
    }
    if (ctx.db === 'mongodb' && ctx.orm === 'mongoose') {
        // .env for Mongoose is already written above via backendEnvContent(ctx)
        const expressTS = `import 'dotenv/config'\nimport mongoose from 'mongoose'\nimport express from 'express'\n\nconst app = express()\nconst port = Number(process.env.PORT) || 3000\nconst url = process.env.DATABASE_URL!\n\nasync function start(){\n  await mongoose.connect(url).then(() => {\n    console.log('Connected to MongoDB')\n  }).catch((err) => {\n    console.error('Error connecting to MongoDB:', err)\n    process.exit(1)\n  });\n  app.get('/api/health', (_req: any, res: any) => res.json({ ok: true }))\n  app.listen(port, () => console.log('API on :' + port))\n}\nstart()\n`;
        const expressJS = `import 'dotenv/config'\nimport mongoose from 'mongoose'\nimport express from 'express'\n\nconst app = express()\nconst port = Number(process.env.PORT) || 3000\nconst url = process.env.DATABASE_URL\n\nasync function start(){\n  await mongoose.connect(url).then(() => {\n    console.log('Connected to MongoDB')\n  }).catch((err) => {\n    console.error('Error connecting to MongoDB:', err)\n    process.exit(1)\n  });\n  app.get('/api/health', (req, res) => res.json({ ok: true }))\n  app.listen(port, () => console.log('API on :' + port))\n}\nstart()\n`;
        const fastifyTS = `import 'dotenv/config'\nimport mongoose from 'mongoose'\nimport Fastify from 'fastify'\n\nconst app = Fastify()\nconst port = Number(process.env.PORT) || 3000\nconst url = process.env.DATABASE_URL!\n\nasync function start(){\n  await mongoose.connect(url).then(() => {\n    console.log('Connected to MongoDB')\n  }).catch((err) => {\n    console.error('Error connecting to MongoDB:', err)\n    process.exit(1)\n  });\n  app.get('/api/health', async () => ({ ok: true }))\n  app.listen({ port, host: '0.0.0.0' }).then(() => console.log('API on :' + port))\n}\nstart()\n`;
        const fastifyJS = `import 'dotenv/config'\nimport mongoose from 'mongoose'\nimport Fastify from 'fastify'\n\nconst app = Fastify()\nconst port = Number(process.env.PORT) || 3000\nconst url = process.env.DATABASE_URL\n\nasync function start(){\n  await mongoose.connect(url).then(() => {\n    console.log('Connected to MongoDB')\n  }).catch((err) => {\n    console.error('Error connecting to MongoDB:', err)\n    process.exit(1)\n  });\n  app.get('/api/health', async () => ({ ok: true }))\n  app.listen({ port, host: '0.0.0.0' }).then(() => console.log('API on :' + port))\n}\nstart()\n`;
        const code = ctx.backend === 'express' ? (isTS ? expressTS : expressJS) : (isTS ? fastifyTS : fastifyJS);
        files.push({ path: path.join(srcDir, `index.${ext}`), contents: code });

        // Add example User model, CRUD routes, and seed script
        const modelDir = path.join(srcDir, 'models');
        const routesDir = path.join(srcDir, 'routes');
        const modelTS = `import mongoose from 'mongoose'\n\nconst userSchema = new mongoose.Schema({\n  email: { type: String, required: true, unique: true },\n  name: { type: String },\n}, { timestamps: true })\n\nexport const User = mongoose.model('User', userSchema)\n`;
        const modelJS = `import mongoose from 'mongoose'\n\nconst userSchema = new mongoose.Schema({\n  email: { type: String, required: true, unique: true },\n  name: { type: String },\n}, { timestamps: true })\n\nexport const User = mongoose.model('User', userSchema)\n`;
        const routerExpressTS = `import { Router } from 'express'\nimport { User } from '../models/User'\nexport const users = Router()\n\nusers.get('/', async (_req, res) => {\n  const list = await User.find().lean()\n  res.json(list)\n})\n\nusers.post('/', async (req: any, res: any) => {\n  const created = await User.create(req.body)\n  res.status(201).json(created)\n})\n\nusers.get('/:id', async (req: any, res: any) => {\n  const item = await User.findById(req.params.id).lean()\n  if (!item) return res.status(404).end()\n  res.json(item)\n})\n\nusers.put('/:id', async (req: any, res: any) => {\n  const item = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()\n  if (!item) return res.status(404).end()\n  res.json(item)\n})\n\nusers.delete('/:id', async (req: any, res: any) => {\n  await User.findByIdAndDelete(req.params.id)\n  res.status(204).end()\n})\n`;
        const routerExpressJS = `import { Router } from 'express'\nimport { User } from '../models/User'\nexport const users = Router()\n\nusers.get('/', async (_req, res) => {\n  const list = await User.find().lean()\n  res.json(list)\n})\n\nusers.post('/', async (req, res) => {\n  const created = await User.create(req.body)\n  res.status(201).json(created)\n})\n\nusers.get('/:id', async (req, res) => {\n  const item = await User.findById(req.params.id).lean()\n  if (!item) return res.status(404).end()\n  res.json(item)\n})\n\nusers.put('/:id', async (req, res) => {\n  const item = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()\n  if (!item) return res.status(404).end()\n  res.json(item)\n})\n\nusers.delete('/:id', async (req, res) => {\n  await User.findByIdAndDelete(req.params.id)\n  res.status(204).end()\n})\n`;
        const routerFastifyTS = `import { User } from '../models/User'\nimport { FastifyInstance } from 'fastify'\nexport async function users(app: FastifyInstance){\n  app.get('/users', async () => await User.find().lean())\n  app.post('/users', async (req: any) => await User.create(req.body))\n  app.get('/users/:id', async (req: any, reply) => {\n    const item = await User.findById(req.params.id).lean()\n    if (!item) return reply.code(404).send()\n    return item\n  })\n  app.put('/users/:id', async (req: any, reply) => {\n    const item = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()\n    if (!item) return reply.code(404).send()\n    return item\n  })\n  app.delete('/users/:id', async (req: any) => {\n    await User.findByIdAndDelete(req.params.id)\n    return { ok: true }\n  })\n}\n`;
        const routerFastifyJS = `import { User } from '../models/User'\nexport async function users(app){\n  app.get('/users', async () => await User.find().lean())\n  app.post('/users', async (req) => await User.create(req.body))\n  app.get('/users/:id', async (req, reply) => {\n    const item = await User.findById(req.params.id).lean()\n    if (!item) return reply.code(404).send()\n    return item\n  })\n  app.put('/users/:id', async (req, reply) => {\n    const item = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()\n    if (!item) return reply.code(404).send()\n    return item\n  })\n  app.delete('/users/:id', async (req) => {\n    await User.findByIdAndDelete(req.params.id)\n    return { ok: true }\n  })\n}\n`;
        const seedTS = `import 'dotenv/config'\nimport mongoose from 'mongoose'\nimport { User } from './src/models/User'\nconst url = process.env.DATABASE_URL!\nasync function run(){\n  await mongoose.connect(url)\n  await User.deleteMany({})\n  await User.create([{ email: 'alice@example.com', name: 'Alice' }, { email: 'bob@example.com', name: 'Bob' }])\n  await mongoose.disconnect()\n  console.log('Seeded')\n}\nrun()\n`;
        const seedJS = `import 'dotenv/config'\nimport mongoose from 'mongoose'\nimport { User } from './src/models/User'\nconst url = process.env.DATABASE_URL\nasync function run(){\n  await mongoose.connect(url)\n  await User.deleteMany({})\n  await User.create([{ email: 'alice@example.com', name: 'Alice' }, { email: 'bob@example.com', name: 'Bob' }])\n  await mongoose.disconnect()\n  console.log('Seeded')\n}\nrun()\n`;
        const modelFile = { path: path.join(modelDir, `User.${isTS ? 'ts' : 'js'}`), contents: isTS ? modelTS : modelJS };
        const routerFile = ctx.backend === 'express'
            ? { path: path.join(routesDir, `users.${isTS ? 'ts' : 'js'}`), contents: isTS ? routerExpressTS : routerExpressJS }
            : { path: path.join(routesDir, `users.${isTS ? 'ts' : 'js'}`), contents: isTS ? routerFastifyTS : routerFastifyJS };
        const seedFile = { path: path.join(root, `seed.${isTS ? 'ts' : 'js'}`), contents: isTS ? seedTS : seedJS };
        files.push(modelFile, routerFile, seedFile);

        // Add a seed script to package.json
        const pkgPath = path.join(root, 'package.json');
        const pkgFile = files.find(f => f.path === pkgPath);
        if (pkgFile) {
            const pkgJson = JSON.parse(pkgFile.contents);
            pkgJson.scripts = pkgJson.scripts || {};
            pkgJson.scripts['seed'] = isTS ? 'tsx seed.ts' : 'node seed.js';
            pkgFile.contents = JSON.stringify(pkgJson, null, 2) + '\n';
        }

        // Wire routes into server
        if (ctx.backend === 'express') {
            // Add import at top-level
            let updated = `import { users } from './routes/users'\n` + code;
            // Insert middleware mounts right after app initialization
            updated = updated.replace(/(const\s+app\s*=\s*express\(\)\s*\n)/, `$1app.use('/api/users', users)\n`);
            files.push({ path: path.join(srcDir, `index.${ext}`), contents: updated });
        } else {
            // Fastify: import at top-level, then register users plugin within start()
            let updated = `import { users } from './routes/users'\n` + code;
            updated = updated.replace(/(app\.get\('[^']*health'[^\n]*\)\n)/, `$1await app.register(async (app) => { await users(app) })\n`);
            files.push({ path: path.join(srcDir, `index.${ext}`), contents: updated });
        }
    }

    if (ctx.dryRun) {
        console.log(kleur.gray(`[dry-run] Write backend files to ${root}`));
    } else {
        await fs.mkdirp(srcDir);
        for (const f of files) await fs.outputFile(f.path, f.contents);
    }
}

module.exports = { generateBackend };
