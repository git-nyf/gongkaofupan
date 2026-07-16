import 'dotenv/config';
import { createApp } from './app';
import { readConfig } from './config';

const config = readConfig();
const app = createApp();

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
