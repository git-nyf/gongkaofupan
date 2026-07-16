import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDatabaseManager } from '../../server/db/database';
import { migrate } from '../../server/db/migrations';

export function createTestDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), 'gongkao-test-'));
  const manager = createDatabaseManager(path.join(directory, 'gongkao.db'));
  migrate(manager.get());

  return {
    get db() {
      return manager.get();
    },
    manager,
    directory,
    dispose() {
      manager.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
