const path = require('path');
const fs = require('fs-extra');

function composeFor(db) {
    if (db === 'postgres') {
        return `version: '3.9'\nservices:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_USER: postgres\n      POSTGRES_PASSWORD: postgres\n      POSTGRES_DB: forge\n    ports:\n      - '5432:5432'\n    volumes:\n      - pgdata:/var/lib/postgresql/data\nvolumes:\n  pgdata: {}\n`;
    }
    if (db === 'mysql') {
        return `version: '3.9'\nservices:\n  db:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: password\n      MYSQL_DATABASE: forge\n    ports:\n      - '3306:3306'\n    command: ['--default-authentication-plugin=mysql_native_password']\n    volumes:\n      - mysqldata:/var/lib/mysql\nvolumes:\n  mysqldata: {}\n`;
    }
    if (db === 'mongodb') {
        return `version: '3.9'\nservices:\n  db:\n    image: mongo:6\n    environment:\n      MONGO_INITDB_ROOT_USERNAME: root\n      MONGO_INITDB_ROOT_PASSWORD: password\n    ports:\n      - '27017:27017'\n    volumes:\n      - mongodata:/data/db\nvolumes:\n  mongodata: {}\n`;
    }
    return '';
}

async function ensureDockerCompose(ctx) {
    const content = composeFor(ctx.db);
    if (!content) return;
    const file = path.join(ctx.projectRoot, 'docker-compose.yml');
    if (ctx.dryRun) return;
    await fs.outputFile(file, content);
}

module.exports = { ensureDockerCompose };
