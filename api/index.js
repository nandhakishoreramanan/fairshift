'use strict';

const config = require('../src/config');
const { createApp } = require('../src/app');
const { createStore } = require('../src/data/store');

let appInstance = null;

function getApp() {
  if (!appInstance) {
    const store = createStore({ now: Date.now(), anonSecret: config.anonSecret });
    appInstance = createApp({ config, store });
  }
  return appInstance;
}

module.exports = (req, res) => {
  const app = getApp();
  return app(req, res);
};
