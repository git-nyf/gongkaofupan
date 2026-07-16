import 'dotenv/config';
import { createApp } from './app';
import { readConfig } from './config';

const config = readConfig();
const app = createApp();

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${config.port}`);
});
