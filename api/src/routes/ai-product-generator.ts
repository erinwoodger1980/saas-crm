import { Router } from 'express';
const router = Router();

// Disabled: use existing AI estimator routes instead.
router.all('*', (_req, res) => {
  res.status(404).json({ error: 'AI product generator route disabled' });
});

export default router;
