const spawn = require('cross-spawn');
const kleur = require('kleur');

function run(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' });
        child.on('exit', (code) => {
            if (code === 0) resolve(); else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
        });
        child.on('error', reject);
    });
}

async function installDependencies(cwd, pkgManager, dryRun) {
    if (dryRun) {
        console.log(kleur.gray(`[dry-run] ${pkgManager} install in ${cwd}`));
        return;
    }
    const map = {
        npm: ['npm', ['install']],
        pnpm: ['pnpm', ['install']],
        yarn: ['yarn', []],
        bun: ['bun', ['install']],
    };
    const [cmd, args] = map[pkgManager] || map.npm;
    console.log(kleur.cyan(`Installing dependencies with ${pkgManager}...`));
    await run(cmd, args, cwd);
}

module.exports = { installDependencies };
