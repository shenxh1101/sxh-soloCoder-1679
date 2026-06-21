import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuthRouter } from './middleware/auth.js';
import { createApiRouter } from './routes/api.js';
import { getMaintenanceAlertVehicles } from './services/business.js';
import { pushNotification } from './services/notification.js';
import { getDb } from './db/index.js';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString(), env: process.env.NODE_ENV });
});

app.use('/api/auth', createAuthRouter());
app.use('/api', createApiRouter());

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
app.use(express.static(DIST_DIR));
app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ message: 'Not found' });
    }
  });
});

interface ApiError extends Error {
  status?: number;
  code?: string;
}

app.use((err: ApiError, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', err);
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || '服务器内部错误';
  res.status(status).json({ error: { code, message, status } });
});

function startMaintenanceCron(): void {
  try {
    cron.schedule('0 0 2 * * *', () => {
      console.log('[Cron] Running maintenance check at', new Date().toISOString());
      const alerts = getMaintenanceAlertVehicles();
      const critical = alerts.filter((a) => a.alertLevel !== 'normal');
      if (critical.length > 0) {
        const db = getDb();
        const dispatchers = db.prepare("SELECT id FROM users WHERE role = 'dispatcher'").all() as { id: number }[];
        critical.forEach((a) => {
          dispatchers.forEach(({ id }) => {
            pushNotification(
              id, 'maintenance',
              `保养${a.alertLevel === 'danger' ? '超期' : '即将到期'}：${a.vehicle.plateNumber}`,
              `当前${a.currentMileage}km，距下次保养${Math.max(0, a.distanceToMaintenance)}km，请尽快安排保养。`,
              'vehicle', a.vehicle.id
            );
          });
        });
      }
    });
    console.log('[Cron] Daily maintenance check scheduled (02:00 AM).');
  } catch (e) {
    console.error('[Cron] Failed to schedule:', e);
  }
}

export { app, startMaintenanceCron };
export default app;
