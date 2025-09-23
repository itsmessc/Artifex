const path = require('path');
const fs = require('fs-extra');
const kleur = require('kleur');

async function generateMobile(ctx) {
    const root = ctx.root || ctx.projectRoot;
    const appJson = {
        expo: {
            name: ctx.name + (ctx.arch === 'fullstack' ? '-mobile' : ''),
            slug: ctx.name + '-mobile',
            scheme: 'forge',
            sdkVersion: '52.0.0'
        }
    };
    const isTS = (ctx.lang || 'ts') === 'ts';
    const pkg = {
        name: ctx.name + (ctx.arch === 'fullstack' ? '-mobile' : ''),
        private: true,
        version: '0.1.0',
        main: isTS ? 'index.ts' : 'index.js',
        scripts: {
            start: 'expo start',
            android: 'expo run:android',
            ios: 'expo run:ios'
        },
        dependencies: {
            expo: '^52.0.0',
            react: '^19.1.1',
            'react-native': '0.76.3'
        }
    };
    if (isTS) {
        pkg.devDependencies = Object.assign({}, pkg.devDependencies || {}, { typescript: '^5.9.2' });
    }
    const index = `import { registerRootComponent } from 'expo'\nimport App from './src/App'\nregisterRootComponent(App)\n`;
    const app = `import { Text, View } from 'react-native'\nexport default function App(){\n  return (<View style={{flex:1, alignItems:'center', justifyContent:'center'}}><Text>ForgeJS + Expo</Text></View>)\n}\n`;

    if (ctx.dryRun) {
        console.log(kleur.gray(`[dry-run] Write mobile files to ${root}`));
        return;
    }
    await fs.outputFile(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    await fs.outputFile(path.join(root, 'app.json'), JSON.stringify(appJson, null, 2) + '\n');
    await fs.outputFile(path.join(root, isTS ? 'index.ts' : 'index.js'), index);
    await fs.outputFile(path.join(root, 'src', isTS ? 'App.tsx' : 'App.js'), app);
    if (isTS) {
        const tsconfig = { compilerOptions: { jsx: 'react-jsx', target: 'ES2020', module: 'ESNext', skipLibCheck: true, strict: true } };
        await fs.outputFile(path.join(root, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
    }
}

module.exports = { generateMobile };
