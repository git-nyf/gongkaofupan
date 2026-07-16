import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app';
import { readConfig } from './config';
import { createDatabaseManager } from './db/database';
import { migrate } from './db/migrations';

const config = readConfig();
mkdirSync(config.dataDir, { recursive: true });
const databaseManager = createDatabaseManager(resolve(config.dataDir, 'gongkao.db'));
migrate(databaseManager.get());
const app = createApp();

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${config.port}`);
});
