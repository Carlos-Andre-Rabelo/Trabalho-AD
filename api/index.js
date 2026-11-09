// Vercel Serverless Function Entry Point for RU Metrics
let appInstance = null;

module.exports = async (req, res) => {
  if (!appInstance) {
    try {
      const { createApp } = require('../backend/dist/app.js');
      appInstance = createApp();
    } catch (err) {
      console.warn('backend/dist/app.js não encontrado, tentando ts-node / backend/src/app.js:', err);
      const { createApp } = require('../backend/src/app.js');
      appInstance = createApp();
    }
  }

  return appInstance(req, res);
};
