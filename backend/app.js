const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const createApiRouter = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const WEB_BUILD = path.join(__dirname, '..', 'frontend', 'dist');

function createApp({ env, gameService, statsService, ai }) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'https://flagcdn.com'],
          'script-src': ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)) }));
  app.use(express.json({ limit: '20kb' }));

  app.use('/api', createApiRouter({ gameService, statsService, ai }));
  app.use('/api', notFound);

  // The Expo web export is served from the same origin, so the deployed site is one service.
  if (fs.existsSync(WEB_BUILD)) {
    app.use(express.static(WEB_BUILD, { maxAge: '1h', index: false }));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(WEB_BUILD, 'index.html')));
  } else {
    app.get('/', (_req, res) => res.send('SA-NQOBA API is running. Build the web app with `npm run build:web`.'));
  }

  app.use(errorHandler);
  return app;
}

module.exports = createApp;
