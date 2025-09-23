const spawn = require('cross-spawn');
const kleur = require('kleur');

function run(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' });
        child.on('exit', (code) => {
            if (code === 0) resolve(); else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
        });
        child.on('error', (err) => {
            if (err && err.code === 'ENOENT') {
                reject(new Error(`Could not find ${cmd} on PATH. Ensure ${cmd} is installed and available in your shell.`));
            } else {
                reject(err);
            }
        });
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
    try {
        await run(cmd, args, cwd);
    } catch (err) {
        console.error(kleur.red(String((err && err.message) || err)));
        console.error(
            kleur.yellow(`If you are on Windows and using PowerShell:
 - Close and reopen your terminal after installing Node/pm to refresh PATH.
 - Confirm the package manager is installed: npm -v | pnpm -v | yarn -v
 - You can also re-run ForgeJS with --install false and install manually inside the generated folder.`)
        );
        throw err;
    }
}

module.exports = { installDependencies };
