const path = require('path');
const fs = require('fs-extra');
const kleur = require('kleur');
const { generateFrontend } = require('./generate-frontend');
const { generateBackend } = require('./generate-backend');
const { generateMobile } = require('./generate-mobile');

function rootPkg(ctx) {
    const workspaces = ['apps/*'];
    let scripts = {};
    if (ctx.pkg === 'npm') {
        scripts = {
            dev: 'npm-run-all --parallel dev:*',
            'dev:web': 'npm run -w apps/web dev',
            'dev:api': 'npm run -w apps/api dev',
            'dev:mobile': 'npm run -w apps/mobile start',
            build: 'npm run -w apps/web build && npm run -w apps/api build',
        };
    } else if (ctx.pkg === 'pnpm') {
        scripts = {
            dev: 'pnpm -w --parallel --filter "./apps/*" dev',
            build: 'pnpm -w --parallel --filter ./apps/* build',
            'dev:api': 'pnpm --filter ./apps/api dev',
            'dev:web': 'pnpm --filter ./apps/web dev',
            'dev:mobile': 'pnpm --filter ./apps/mobile start',
        };
    } else if (ctx.pkg === 'yarn') {
        scripts = {
            dev: 'yarn workspaces run dev',
            build: 'yarn workspaces run build',
            'dev:api': 'yarn workspace api dev',
            'dev:web': 'yarn workspace web dev',
            'dev:mobile': 'yarn workspace mobile start',
        };
    }
    const pkg = {
        name: ctx.name,
        private: true,
        version: '0.1.0',
        scripts,
    };
    if (ctx.pkg === 'npm' || ctx.pkg === 'yarn') {
        pkg.workspaces = workspaces;
    }
    if (ctx.pkg === 'npm') {
        pkg.devDependencies = Object.assign({}, pkg.devDependencies || {}, { 'npm-run-all': '^4.1.5' });
    }
    return pkg;
}

async function generateMonorepo(ctx) {
    const root = ctx.projectRoot;
    const appsDir = path.join(root, 'apps');
    const webDir = path.join(appsDir, 'web');
    const apiDir = path.join(appsDir, 'api');
    const mobileDir = path.join(appsDir, 'mobile');

    if (ctx.dryRun) {
        console.log(kleur.gray(`[dry-run] Create monorepo at ${root}`));
    } else {
        if (ctx.frontend !== 'expo') await fs.mkdirp(webDir);
        await fs.mkdirp(apiDir);
        if (ctx.frontend === 'expo') await fs.mkdirp(mobileDir);
    }

    // Write root package.json
    const rootPkgJSON = rootPkg(ctx);
    // For pnpm, create workspace file
    if (ctx.pkg === 'pnpm' && !ctx.dryRun) {
        await fs.outputFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
    }
    if (!ctx.dryRun) {
        await fs.outputFile(path.join(root, 'package.json'), JSON.stringify(rootPkgJSON, null, 2) + '\n');
    } else {
        console.log(kleur.gray(`[dry-run] Write root package.json with workspaces`));
    }

    // Generate sub-apps
    if (ctx.frontend !== 'expo') {
        await generateFrontend({ ...ctx, root: webDir });
    }
    await generateBackend({ ...ctx, root: apiDir });
    if (ctx.frontend === 'expo') {
        await generateMobile({ ...ctx, root: mobileDir });
    }

    // Root README placeholder updated later by writeRootReadme
}

module.exports = { generateMonorepo };
