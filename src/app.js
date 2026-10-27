'use strict';

const path = require('node:path');
const express = require('express');
const defaultConfig = require('./config');
const { createStore } = require('./data/store');
const { securityHeaders, errorHandler } = require('./middleware');

/**
 * Build the Express app. Dependencies are injectable so tests can use a fixed
 * clock and a fresh store.
 */
function createApp({ config = defaultConfig, clock = Date.now, store } = {}) {
  const db = store || createStore({ now: clock(), anonSecret: config.anonSecret });
  const deps = { store: db, config, clock };
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Cloud Run sits behind Google's front end
  app.use(securityHeaders);
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/auth', require('./routes/auth')(deps));
  app.use('/api/worker', require('./routes/worker')(deps));
  app.use('/api/admin', require('./routes/admin')(deps));
  app.use('/api', require('./routes/public')(deps));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  const fs = require('node:fs');
  const publicDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicDir)) {
    app.use(
      express.static(publicDir, {
        extensions: ['html'],
        maxAge: 0,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      }),
    );
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
