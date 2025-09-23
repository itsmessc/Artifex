const path = require('path');
const fs = require('fs-extra');
const kleur = require('kleur');
const spawn = require('cross-spawn');

function run(cmd, args, cwd, dryRun) {
    if (dryRun) {
        console.log(kleur.gray(`[dry-run] ${cmd} ${args.join(' ')} (cwd=${cwd})`));
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' });
        child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
        child.on('error', reject);
    });
}

async function addTailwind(ctx, root, framework) {
    // Tailwind v4 via @tailwindcss/vite plugin
    const pm = ctx.pkg || 'npm';
    const addMap = {
        npm: ['npm', ['i', '-D', 'tailwindcss', '@tailwindcss/vite']],
        pnpm: ['pnpm', ['add', '-D', 'tailwindcss', '@tailwindcss/vite']],
        yarn: ['yarn', ['add', '-D', 'tailwindcss', '@tailwindcss/vite']],
        bun: ['bun', ['add', '-d', 'tailwindcss', '@tailwindcss/vite']],
    };
    const [cmd, args] = addMap[pm] || addMap.npm;
    await run(cmd, args, root, ctx.dryRun);

    // Update vite config to include plugin
    const viteTS = path.join(root, 'vite.config.ts');
    const viteJS = path.join(root, 'vite.config.js');
    const viteFile = await fs.pathExists(viteTS) ? viteTS : viteJS;
    if (viteFile) {
        let viteContent = await fs.readFile(viteFile, 'utf-8');
        // Ensure import
        if (!viteContent.includes("@tailwindcss/vite")) {
            viteContent = `import tailwindcss from '@tailwindcss/vite'\n` + viteContent;
        } else {
            // Normalize variable name if previously added differently
            viteContent = viteContent.replace(
                /import\s+([^\s]+)\s+from\s+'@tailwindcss\/vite'/,
                "import tailwindcss from '@tailwindcss/vite'"
            );
        }
        // Inject tailwindcss() into plugins array; fallback to adding plugins if missing
        if (/plugins:\s*\[/.test(viteContent)) {
            viteContent = viteContent.replace(/plugins:\s*\[(.*?)\]/s, (m, inner) => {
                if (inner.includes('tailwindcss()')) return m;
                const updated = inner.trim().length ? `${inner}, tailwindcss()` : 'tailwindcss()';
                return `plugins: [${updated}]`;
            });
        } else if (/defineConfig\s*\(\s*\{/.test(viteContent)) {
            viteContent = viteContent.replace(/defineConfig\s*\(\s*\{/, match => `${match} plugins: [tailwindcss()], `);
        }
        await fs.outputFile(viteFile, viteContent);
    }

    // Ensure CSS imports Tailwind v4
    const candidates = [];
    if (framework === 'react') candidates.push(path.join(root, 'src', 'index.css'));
    if (framework === 'vue') candidates.push(path.join(root, 'src', 'style.css'));
    if (framework === 'svelte') candidates.push(path.join(root, 'src', 'app.css'));
    if (framework === 'angular') candidates.push(path.join(root, 'src', 'styles.css'));
    // Generic fallbacks
    candidates.push(path.join(root, 'src', 'styles.css'));
    candidates.push(path.join(root, 'src', 'style.css'));
    candidates.push(path.join(root, 'src', 'index.css'));
    candidates.push(path.join(root, 'src', 'app.css'));

    let cssFile = null;
    for (const c of candidates) {
        if (await fs.pathExists(c)) { cssFile = c; break; }
    }
    if (!cssFile) {
        cssFile = path.join(root, 'src', framework === 'react' ? 'index.css' : 'style.css');
        if (!ctx.dryRun) await fs.ensureFile(cssFile);
        else console.log(kleur.gray(`[dry-run] create ${cssFile}`));
    }
    if (cssFile) {
        const existing = (await fs.pathExists(cssFile)) ? await fs.readFile(cssFile, 'utf-8') : '';
        if (!existing.includes('@import "tailwindcss"')) {
            const content = `@import "tailwindcss";\n\n${existing}`;
            await fs.outputFile(cssFile, content);
        }
    }
}

async function generateFrontend(ctx) {
    const framework = ctx.frontend || 'react';
    const isTS = (ctx.lang || 'ts') === 'ts';
    const root = ctx.root || ctx.projectRoot;

    if (framework === 'angular') {
        // Use official Analog create command to scaffold Angular + Vite
        const pm = ctx.pkg || 'npm';
        const createMap = {
            npm: ['npm', ['create', 'analog@latest', '.']],
            pnpm: ['pnpm', ['create', 'analog@latest', '.']],
            yarn: ['yarn', ['create', 'analog', '.']],
            bun: ['bunx', ['create-analog@latest', '.']],
        };
        const [cmd, args] = createMap[pm] || createMap.npm;
        if (ctx.dryRun) {
            console.log(kleur.gray(`[dry-run] Scaffold Angular via ${cmd} ${args.join(' ')} in ${root}`));
        } else {
            await fs.mkdirp(root);
        }
        await run(cmd, args, root, ctx.dryRun);
        if (ctx.css === 'tailwind') {
            await addTailwind(ctx, root, 'angular');
        }
        return;
    }

    // Use official Vite scaffolding for React/Vue/Svelte
    const pm = ctx.pkg || 'npm';
    const templateMap = {
        react: isTS ? 'react-ts' : 'react',
        vue: isTS ? 'vue-ts' : 'vue',
        svelte: isTS ? 'svelte-ts' : 'svelte',
    };
    const template = templateMap[framework] || templateMap.react;
    const createMap = {
        npm: ['npm', ['create', 'vite@latest', '.', '--', '--template', template]],
        pnpm: ['pnpm', ['create', 'vite', '.', '--', '--template', template]],
        yarn: ['yarn', ['create', 'vite', '.', '--', '--template', template]],
        bun: ['bunx', ['create-vite@latest', '.', '--template', template]],
    };
    const [cmd, args] = createMap[pm] || createMap.npm;

    if (ctx.dryRun) {
        console.log(kleur.gray(`[dry-run] Scaffold ${framework} via ${cmd} ${args.join(' ')} in ${root}`));
    } else {
        await fs.mkdirp(root);
    }
    await run(cmd, args, root, ctx.dryRun);

    if (ctx.css === 'tailwind') {
        await addTailwind(ctx, root, framework);
    }

    // Additional preprocessors (scss/less) can be added by user; Vite supports them when installed.
}

module.exports = { generateFrontend };
