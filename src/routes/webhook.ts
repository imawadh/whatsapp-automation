import { Router, type Request, type Response } from 'express';

const router = Router();

router.post('/webhook', (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/xml');
  res.send(
    `<Response><Message>Awadh will contact you soon</Message></Response>`,
  );
});

export default router;
