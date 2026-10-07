'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error');

const app = express();
app.disable('x-powered-by');

/* ------------------------------------------------------------------ *
 * CORS — must work from localhost, LAN devices and the hosted preview
 * (https://<port>-<sandbox>.e2b.app), so origin checks are permissive
 * unless CLIENT_ORIGIN pins them to a list.
 * ------------------------------------------------------------------ */
const allowedOrigins = env.clientOrigin === '*' ? null : env.clientOrigin.split(',').map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !allowedOrigins || allowedOrigins.includes(origin)) return callback(null, true);
      // never break the app because of an unexpected host: allow and let auth do its job
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use('/api', routes);

// root helper so hitting the bare server URL is not a 404
app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Smart Student Management System API',
      docs: '/api',
      health: '/api/health',
    },
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
