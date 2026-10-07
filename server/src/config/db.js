'use strict';

const mongoose = require('mongoose');
const env = require('./env');
const { setMemoryMode, isMemoryMode } = require('../lib/modelFactory');

/**
 * Connects to MongoDB. If the server cannot be reached and the in-memory fallback is
 * allowed, the app keeps working with the built-in demo store.
 *
 * @returns {Promise<'mongodb'|'memory'>} the active storage mode
 */
async function connectDatabase() {
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      autoIndex: true,
    });
    setMemoryMode(false);
    console.log(`\x1b[32m✔\x1b[0m MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name}`);
    return 'mongodb';
  } catch (error) {
    if (!env.allowInMemoryFallback) {
      console.error('\x1b[31m✖\x1b[0m MongoDB connection failed:', error.message);
      throw error;
    }

    setMemoryMode(true);
    console.warn(
      [
        '',
        '\x1b[33m⚠  MongoDB is not reachable — starting with the built-in in-memory demo store.\x1b[0m',
        `   Reason     : ${error.message.split('\n')[0]}`,
        `   Target URI : ${env.mongoUri}`,
        '   Everything works (login, attendance, AI papers, WhatsApp alerts), but data resets',
        '   on restart. Start MongoDB and reload, or set MONGO_URI to a MongoDB Atlas cluster,',
        '   to use the real database. Set ALLOW_IN_MEMORY_FALLBACK=false to disable this.',
        '',
      ].join('\n')
    );
    return 'memory';
  }
}

async function disconnectDatabase() {
  if (!isMemoryMode() && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

const databaseStatus = () => ({
  mode: isMemoryMode() ? 'memory' : 'mongodb',
  connected: isMemoryMode() ? true : mongoose.connection.readyState === 1,
  host: isMemoryMode() ? 'in-memory demo store' : mongoose.connection.host || null,
  database: isMemoryMode() ? 'demo' : mongoose.connection.name || null,
});

module.exports = { connectDatabase, disconnectDatabase, databaseStatus };
