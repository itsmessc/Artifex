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

async function generateMobile(ctx) {
    const root = ctx.root || ctx.projectRoot;
    const isTS = (ctx.lang || 'ts') === 'ts';
    const pm = ctx.pkg || 'npm';

    // Use official Expo scaffolder via the chosen package manager
    // Let the user choose the template from Expo's list; default maps to no --template
    const chosen = ctx.expoTemplate || (isTS ? 'blank-typescript' : 'blank');
    const createMap = {
        npm: ['npm', ['create', 'expo-app@latest', '.', '--', '--template', chosen, '--yes']],
        pnpm: ['pnpm', ['create', 'expo-app', '.', '--', '--template', chosen, '--yes']],
        yarn: ['yarn', ['create', 'expo-app', '.', '--template', chosen, '--yes']],
        bun: ['bunx', ['create-expo-app@latest', '.', '--template', chosen, '--yes']],
    };
    const [cmd, args] = createMap[pm] || createMap.npm;
    // If 'default' is selected, remove the --template pair to let Expo use its recommended default
    if (chosen === 'default') {
        const idx = args.indexOf('--template');
        if (idx !== -1) args.splice(idx, 2);
    }

    if (ctx.dryRun) {
        console.log(kleur.gray(`[dry-run] Scaffold Expo via ${cmd} ${args.join(' ')} in ${root}`));
        return;
    }
    await fs.mkdirp(root);
    await run(cmd, args, root, ctx.dryRun);

    // Optionally adjust the app name/slug after creation
    try {
        const appJsonPath = path.join(root, 'app.json');
        if (await fs.pathExists(appJsonPath)) {
            const appJson = JSON.parse(await fs.readFile(appJsonPath, 'utf-8'));
            const name = ctx.name + (ctx.arch === 'fullstack' ? '-mobile' : '');
            appJson.expo = appJson.expo || {};
            appJson.expo.name = appJson.expo.name || name;
            appJson.expo.slug = appJson.expo.slug || name;
            await fs.outputFile(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
        }
    } catch (_) { /* non-fatal */ }
}

module.exports = { generateMobile };
