/**
 * local server entry file, for local development
 */
import app, { startMaintenanceCron } from './app.js';
import { getDb } from './db/index.js';

const PORT = process.env.PORT || 3001;

try {
  getDb();
  console.log('Database initialized successfully.');
} catch (err) {
  console.error('Failed to initialize database:', err);
  process.exit(1);
}

startMaintenanceCron();

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`API base: http://localhost:${PORT}/api`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;