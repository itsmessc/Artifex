const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function prependToPath(dir) {
    if (!dir) return;
    const current = process.env.PATH || '';
    const segments = current.split(path.delimiter).filter(Boolean);
    if (!segments.includes(dir)) {
        process.env.PATH = [dir, ...segments].join(path.delimiter);
    }
}

function which(cmd) {
    const isWin = process.platform === 'win32';
    const check = isWin ? `${cmd}.cmd` : cmd;
    const res = spawnSync(isWin ? 'where' : 'which', [check], { encoding: 'utf-8', shell: true });
    return res.status === 0;
}

function getVersion(cmd, args = ['--version']) {
    try {
        const res = spawnSync(cmd, args, { encoding: 'utf-8', shell: process.platform === 'win32' });
        if (res.status === 0) return (res.stdout || res.stderr || '').toString().trim();
    } catch (_) { }
    return null;
}

function detectPackageManagerAvailability() {
    return {
        npm: which('npm'),
        pnpm: which('pnpm'),
        yarn: which('yarn'),
        bun: which('bun'),
    };
}

function getInstalledPmVersions() {
    return {
        npm: getVersion('npm'),
        pnpm: getVersion('pnpm'),
        yarn: getVersion('yarn'),
        bun: getVersion('bun'),
    };
}

async function installPackageManager(pm, dryRun = false) {
    // Non-intrusive, best-effort installers. We prefer corepack for yarn/pnpm.
    // On Windows, we use PowerShell-friendly commands.
    const isWin = process.platform === 'win32';
    const run = (command, args = [], options = {}) => {
        if (dryRun) return 0;
        const result = spawnSync(command, args, { stdio: 'inherit', shell: options.shell ?? isWin });
        return typeof result.status === 'number' ? result.status : 1;
    };

    if (pm === 'pnpm') {
        // Try corepack first (Node 16.10+ typically). If that fails fallback to npm -g install pnpm
        const corepack = which('corepack');
        if (corepack) {
            const s1 = run('corepack', ['enable']);
            const s2 = run('corepack', ['prepare', 'pnpm@latest', '--activate']);
            return s1 === 0 && s2 === 0;
        }
        const s3 = run('npm', ['install', '-g', 'pnpm']);
        return s3 === 0;
    }
    if (pm === 'yarn') {
        const corepack = which('corepack');
        if (corepack) {
            const s1 = run('corepack', ['enable']);
            const s2 = run('corepack', ['prepare', 'yarn@stable', '--activate']);
            return s1 === 0 && s2 === 0;
        }
        // Fallback global install (classic yarn):
        const s3 = run('npm', ['install', '-g', 'yarn']);
        return s3 === 0;
    }
    if (pm === 'bun') {
        if (isWin) {
            const installCmd = 'Invoke-WebRequest -UseBasicParsing https://bun.sh/install.ps1 | Invoke-Expression';
            const status = run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', installCmd], { shell: false });
            if (status === 0) {
                const bunDir = path.join(os.homedir(), '.bun', 'bin');
                if (fs.existsSync(path.join(bunDir, 'bun.exe'))) {
                    prependToPath(bunDir);
                }
                return true;
            }
            return false;
        }
        const status = run('bash', ['-c', 'curl -fsSL https://bun.sh/install | bash'], { shell: false });
        if (status === 0) {
            const bunDir = path.join(os.homedir(), '.bun', 'bin');
            if (fs.existsSync(path.join(bunDir, 'bun'))) {
                prependToPath(bunDir);
            }
            return true;
        }
        return false;
    }
    // npm comes with Node; nothing to install here.
    return true;
}

function resolvePackageManager(preferredPm) {
    const availability = detectPackageManagerAvailability();
    if (preferredPm && availability[preferredPm]) return preferredPm;
    // Priority order: pnpm > npm > yarn > bun
    if (availability.pnpm) return 'pnpm';
    if (availability.npm) return 'npm';
    if (availability.yarn) return 'yarn';
    if (availability.bun) return 'bun';
    // Default to npm
    return 'npm';
}

module.exports = {
    which,
    getVersion,
    detectPackageManagerAvailability,
    getInstalledPmVersions,
    installPackageManager,
    resolvePackageManager,
};

