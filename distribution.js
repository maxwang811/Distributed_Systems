#!/usr/bin/env node
/**
 * @typedef {import("./distribution/types.js").Node} Node
 */

const log = require('./distribution/util/log.js');

/**
 * @param {Node} [config]
 */
function bootstrap(config) {
  const previousServer = globalThis.distribution?.node?.server;
  if (previousServer && typeof previousServer.close === 'function') {
    try {
      previousServer.close();
    } catch {
      // Ignore best-effort shutdown errors from previous test contexts.
    }
  }

  const distribution = {};


  distribution.util = require('./distribution/util/util.js');

  distribution.node = require('./distribution/local/node.js');
  if (config) {
    distribution.node.config = config;
  }
  distribution.local = require('./distribution/local/local.js');
  // Some group services reference globalThis.distribution during setup.
  globalThis.distribution = distribution;

  const {setup} = require('./distribution/all/all.js');
  distribution.all = setup({gid: 'all'});

  /* Overrides when missing functionality from previous milestone or extra credit is needed */

  /* __start_M3_solution__
  distribution.util.wire.createRPC = distributionLib.util.wire.createRPC;
  distribution.local.routes = distributionLib.local.routes;
  distribution.local.status.spawn = distributionLib.local.status.spawn;
  distribution.local.status.stop = distributionLib.local.status.stop;
  distribution.local.comm = distributionLib.local.comm;
  distribution.node.start = distributionLib.node.start;
  __end_M3_solution__ */

  for (const [key, service] of Object.entries(distribution.local)) {
    distribution.local.routes.put(service, key, () => {});
  }

  return distribution;
}

/*
  This logic determines which implementation of the distribution library to use.
  It can either be:
  1. The reference implementation from the library @brown-ds/distribution
  2. Your own, local implementation
  Set "useLibrary" in package.json to true or false accordingly.
*/
// @ts-ignore JSON import resolved at runtime.
const {useLibrary} = require('./package.json');
// @ts-ignore Optional dependency for reference implementation.
const distribution = useLibrary ? require('@brown-ds/distribution') : bootstrap;

/* The following code is run when distribution.js is invoked directly */
if (require.main === module) {
  globalThis.distribution = distribution();
  globalThis.distribution.node.start(globalThis.distribution.node.config.onStart || (() => {
    // Start REPL for interactive use
    const repl = require('node:repl');
    repl.start({
      prompt: `${globalThis.distribution.util.id.getSID(globalThis.distribution.node.config)}> `,
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      useGlobal: true,
    });
  }));
}

module.exports = distribution;
