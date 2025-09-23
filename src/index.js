const path = require('path');
const fs = require('fs-extra');
const { hideBin } = require('yargs/helpers');
const yargs = require('yargs/yargs');
const prompts = require('prompts');
const kleur = require('kleur');
const semver = require('semver');

const { generateFrontend } = require('./lib/generate-frontend');
const { generateBackend } = require('./lib/generate-backend');
const { generateMonorepo } = require('./lib/generate-monorepo');
const { ensureDockerCompose } = require('./lib/generate-docker');
const { writeRootReadme } = require('./lib/write-readme');
const { installDependencies } = require('./lib/install');
const { detectPackageManagerAvailability, installPackageManager, resolvePackageManager } = require('./lib/utils');

function assertNodeVersion() {
    const min = '16.14.0';
    if (!semver.gte(process.version, min)) {
        console.error(kleur.red(`ForgeJS requires Node ${min}+; current ${process.version}`));
        process.exit(1);
    }
}

async function main() {
    assertNodeVersion();
    const argv = yargs(hideBin(process.argv))
        .scriptName('forgejs')
        .usage('$0 [name] [options]')
        .positional('name', { describe: 'Project name', type: 'string' })
        .option('yes', { alias: 'y', type: 'boolean', desc: 'Skip prompts and use defaults' })
        .option('dir', { type: 'string', desc: 'Target directory', default: '.' })
        .option('name', { type: 'string', desc: 'Project name (overrides positional)' })
        .option('arch', { type: 'string', choices: ['frontend', 'backend', 'fullstack', 'mobile'], desc: 'Architecture' })
        .option('frontend', { type: 'string', choices: ['react', 'vue', 'svelte', 'angular', 'expo'], desc: 'Frontend framework' })
        .option('backend', { type: 'string', choices: ['express', 'fastify'], desc: 'Backend framework' })
        .option('db', { type: 'string', choices: ['none', 'postgres', 'mysql', 'mongodb'], default: 'none', desc: 'Database type' })
        .option('orm', { type: 'string', choices: ['none', 'prisma', 'mongoose'], default: 'prisma', desc: 'ORM/ODM choice' })
        .option('css', { type: 'string', choices: ['css', 'scss', 'sass', 'less', 'tailwind'], default: 'css', desc: 'CSS styling' })
        .option('pkg', { type: 'string', choices: ['npm', 'pnpm', 'yarn', 'bun'], default: 'npm', desc: 'Package manager' })
        .option('lang', { type: 'string', choices: ['ts', 'js'], default: 'ts', desc: 'Language for generated code' })
        .option('dry-run', { type: 'boolean', desc: 'Print actions without writing files' })
        .option('install', { type: 'boolean', desc: 'Install dependencies for generated apps', default: true })
        .help()
        .alias('h', 'help')
        .version('0.1.0')
        .parse();

    const defaults = {
        arch: 'fullstack',
        frontend: 'react',
        backend: 'express',
        db: 'postgres',
        orm: 'prisma',
        css: 'tailwind',
        pkg: 'pnpm',

        lang: 'ts',
    };

    let answers = { ...defaults, ...argv };
    answers.name = argv.name || argv._[0] || 'forge-app';

    if (!argv.yes) {
        const res = await prompts([
            { type: 'text', name: 'name', message: 'Project name', initial: answers.name },
            {
                type: 'select', name: 'arch', message: 'What type of project are you building?', initial: 0, choices: [
                    { title: 'Full-Stack Application', value: 'fullstack' },
                    { title: 'Frontend-Only', value: 'frontend' },
                    { title: 'Backend-Only', value: 'backend' },
                    { title: 'Mobile App (Expo)', value: 'mobile' },
                ]
            },
            {
                type: 'select', name: 'lang', message: 'Language', initial: 0, choices: [
                    { title: 'TypeScript', value: 'ts' },
                    { title: 'JavaScript', value: 'js' },
                ]
            },
            // Frontend questions (hidden for Backend-Only and Mobile App)
            {
                type: (prev, values) => (values.arch !== 'backend' && values.arch !== 'mobile' ? 'select' : null), name: 'frontend', message: 'Which frontend framework?', choices: [
                    { title: 'React (Vite)', value: 'react' },
                    { title: 'Vue (Vite)', value: 'vue' },
                    { title: 'Svelte (Vite)', value: 'svelte' },
                    { title: 'Angular (Vite)', value: 'angular' },
                    { title: 'Expo (React Native)', value: 'expo' },
                ], initial: 0
            },

            // Backend questions (hidden for Frontend-Only and Mobile App)
            {
                type: (prev, values) => (values.arch !== 'frontend' && values.arch !== 'mobile' ? 'select' : null), name: 'backend', message: 'Which Node.js server framework?', choices: [
                    { title: 'Express', value: 'express' },
                    { title: 'Fastify', value: 'fastify' },
                ], initial: 0
            },
            {
                type: (prev, values) => (values.arch === 'frontend' || values.arch === 'mobile' ? null : 'select'), name: 'db', message: 'Which database?', choices: [
                    { title: 'None', value: 'none' },
                    { title: 'PostgreSQL', value: 'postgres' },
                    { title: 'MySQL', value: 'mysql' },
                    { title: 'MongoDB', value: 'mongodb' },
                ], initial: 1
            },
            {
                type: (prev, values) => (prev === 'none' ? null : 'select'),
                name: 'orm',
                message: (_prev, values) => values.db === 'mongodb' ? 'Choose a database client/ODM:' : 'Choose a database client/ORM:',
                choices: (_prev, values) => values.db === 'mongodb'
                    ? [
                        { title: 'Mongoose (ODM)', value: 'mongoose' },
                        { title: 'Prisma (experimental MongoDB)', value: 'prisma' },
                        { title: 'None', value: 'none' },
                    ]
                    : [
                        { title: 'Prisma', value: 'prisma' },
                        { title: 'None', value: 'none' },
                    ],
                initial: 0
            },
            // Styling and package manager
            {
                type: (prev, values) => (values.arch !== 'backend' && values.frontend !== 'expo' && values.arch !== 'mobile' ? 'select' : null), name: 'css', message: 'Styling', choices: [
                    { title: 'Plain CSS', value: 'css' },
                    { title: 'SCSS', value: 'scss' },
                    { title: 'SASS (indented)', value: 'sass' },
                    { title: 'Less', value: 'less' },
                    { title: 'Tailwind CSS', value: 'tailwind' },
                ], initial: 4
            },
            {
                type: 'select', name: 'pkg', message: 'Package manager', choices: [
                    { title: 'pnpm (recommended for monorepos)', value: 'pnpm' },
                    { title: 'npm', value: 'npm' },
                    { title: 'yarn', value: 'yarn' },
                    { title: 'bun', value: 'bun' },
                ], initial: 0
            },
        ], {
            onCancel: () => {
                console.log(kleur.yellow('Aborted.'));
                process.exit(0);
            }
        });
        answers = { ...answers, ...res };
    }

    const targetDir = path.resolve(process.cwd(), argv.dir || '.');
    const projectRoot = path.join(targetDir, answers.name || 'forge-app');
    let ctx = { ...answers, projectRoot, dryRun: !!argv['dry-run'], install: !!argv.install };

    // Validate chosen package manager availability and offer to install if missing
    const availability = detectPackageManagerAvailability();
    let pm = ctx.pkg || 'npm';
    if (!availability[pm]) {
        if (!argv.yes) {
            const { installPm } = await prompts({
                type: 'confirm',
                name: 'installPm',
                message: `${pm} is not installed on this system. Do you want me to install it now?`,
                initial: pm === 'pnpm' || pm === 'yarn',
            });
            if (installPm) {
                const ok = await installPackageManager(pm, ctx.dryRun);
                if (!ok) {
                    console.log(kleur.yellow(`Could not install ${pm} automatically. Falling back to npm.`));
                    pm = 'npm';
                }
            } else {
                console.log(kleur.yellow(`Using npm instead of ${pm} (not installed).`));
                pm = 'npm';
            }
        } else {
            console.log(kleur.yellow(`Using npm instead of ${pm} (not installed).`));
            pm = 'npm';
        }
    }
    // Resolve to a working PM just in case
    pm = resolvePackageManager(pm);
    ctx.pkg = pm;

    // Final summary
    const lines = [];
    const frontendLabel = (fw) => {
        if (fw === 'react') return 'React (Vite) + TypeScript';
        if (fw === 'vue') return 'Vue (Vite) + TypeScript';
        if (fw === 'svelte') return 'Svelte (Vite) + TypeScript';
        if (fw === 'angular') return 'Angular (Vite) + TypeScript';
        return 'Vite + TypeScript';
    };
    const langLabel = ctx.lang === 'js' ? 'JavaScript' : 'TypeScript';
    if (answers.arch === 'fullstack') {
        lines.push('Ready to forge your full-stack project:\n');
        lines.push(`- Structure: Monorepo (${answers.pkg} workspaces)`);
        lines.push('- Apps:');
        const wantWeb = answers.frontend !== 'expo';
        const wantMobile = answers.frontend === 'expo';
        if (wantWeb) lines.push(`  - \`web\`:    ${frontendLabel(answers.frontend).replace('TypeScript', langLabel)}`);
        if (wantMobile) lines.push(`  - \`mobile\`: Expo (React Native)`);
        lines.push(`  - \`api\`:    ${answers.backend === 'fastify' ? 'Fastify' : 'Express'} + ${langLabel}`);
        if (answers.db && answers.db !== 'none') {
            lines.push('- Database:');
            lines.push(`  - \`type\`: ${answers.db === 'postgres' ? 'PostgreSQL' : answers.db === 'mysql' ? 'MySQL' : 'MongoDB'}`);
            lines.push(`  - \`${answers.db === 'mongodb' ? 'odm' : 'orm'}\`:  ${answers.orm}`);
            lines.push('  - \`dev\`:  Docker Compose setup included');
        }
    } else if (answers.arch === 'frontend') {
        lines.push('Ready to forge your frontend project:\n');
        if (answers.frontend === 'expo') {
            lines.push(`- Framework: Expo (React Native) + ${langLabel}`);
        } else {
            lines.push(`- Framework: ${frontendLabel(answers.frontend).replace('TypeScript', langLabel)}`);
            lines.push(`- Styling: ${answers.css}`);
        }
    } else if (answers.arch === 'mobile') {
        lines.push('Ready to forge your mobile project:\n');
        lines.push(`- Framework: Expo (React Native) + ${langLabel}`);
    } else {
        lines.push('Ready to forge your backend project:\n');
        lines.push(`- Server: ${answers.backend === 'fastify' ? 'Fastify' : 'Express'} + ${langLabel}`);
        if (answers.db && answers.db !== 'none') {
            lines.push('- Database:');
            lines.push(`  - \`type\`: ${answers.db}`);
            lines.push(`  - \`${answers.db === 'mongodb' ? 'odm' : 'orm'}\`:  ${answers.orm}`);
            lines.push('  - \`dev\`:  Docker Compose setup included');
        }
    }

    console.log(kleur.cyan('\n' + lines.join('\n')));
    if (!argv.yes) {
        const { proceed } = await prompts({ type: 'confirm', name: 'proceed', message: 'Proceed?', initial: true });
        if (!proceed) {
            console.log(kleur.yellow('Aborted.'));
            process.exit(0);
        }
    }

    console.log(kleur.cyan(`\nForgeJS will create: ${kleur.bold(answers.arch)} in ${projectRoot}\n`));

    if (ctx.dryRun) console.log(kleur.yellow('[dry-run] No files will be written.'));

    if (!ctx.dryRun) await fs.mkdirp(projectRoot);

    // Enforce TS for Angular
    if ((answers.arch === 'frontend' && answers.frontend === 'angular') || (answers.arch === 'fullstack' && answers.frontend === 'angular')) {
        if (ctx.lang === 'js') {
            console.log(kleur.yellow('Angular requires TypeScript; switching language to TypeScript.'));
            ctx.lang = 'ts';
        }
    }

    if (answers.arch === 'fullstack') {
        await generateMonorepo(ctx);
    } else if (answers.arch === 'frontend') {
        if (answers.frontend === 'expo') {
            const { generateMobile } = require('./lib/generate-mobile');
            await generateMobile({ ...ctx, root: projectRoot });
        } else {
            await generateFrontend({ ...ctx, root: projectRoot });
        }
    } else if (answers.arch === 'backend') {
        await generateBackend({ ...ctx, root: projectRoot });
    } else if (answers.arch === 'mobile') {
        const { generateMobile } = require('./lib/generate-mobile');
        await generateMobile({ ...ctx, root: projectRoot });
    }

    if ((answers.arch === 'fullstack' || answers.arch === 'backend') && answers.db && answers.db !== 'none') {
        await ensureDockerCompose(ctx);
    }

    await writeRootReadme(ctx);

    if (ctx.install) {
        const installPath = projectRoot;
        await installDependencies(installPath, ctx.pkg, ctx.dryRun);
    }

    console.log(kleur.green(`\nDone. Next: \n - cd ${path.relative(process.cwd(), projectRoot) || '.'}\n - Open README for commands.\n`));
}

main().catch((err) => {
    console.error(kleur.red(err.stack || err.message));
    process.exit(1);
});
