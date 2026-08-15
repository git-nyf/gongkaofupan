import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabaseManager } from '../db/database';
import { migrate } from '../db/migrations';
import { readConfig } from '../config';
import { createDailyAnkiService } from './daily';
import { sendAnkiBundle } from './sender';

const config = readConfig();
mkdirSync(config.dataDir, { recursive: true });
const database = createDatabaseManager(resolve(config.dataDir, 'gongkao.db'));

try {
  migrate(database.get());
  const service = createDailyAnkiService({
    database,
    outputDirectory: config.anki.outputDirectory,
    sender: (input) => sendAnkiBundle({
      ...input,
      command: config.anki.ccConnectCommand,
    }),
  });
  const result = await service.generateAndSend(10);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status === 'generated' && !result.sent) process.exitCode = 1;
} finally {
  database.close();
}
