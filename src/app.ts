import { existsSync } from 'node:fs';
import express, { type Express, type Request, type Response } from 'express';
import whatsappRouter from './routes/whatsapp.ts';

// Node reads .env natively, no dotenv needed. On Render the vars come from the
// dashboard and there is no .env file, so only load it when one exists.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const app: Express = express();

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello World!');
});

app.use(whatsappRouter);

// Render injects PORT; fall back to 3000 for local dev.
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
