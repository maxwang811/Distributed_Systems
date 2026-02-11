// @ts-check
/**
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").Callback} Callback
 */
const http = require('node:http');
const url = require('node:url');
const log = require('../util/log.js');
const serialization = require('../util/serialization.js');

const yargs = require('yargs/yargs');

/**
 * @returns {Node}
 */
function setNodeConfig() {
  const args = yargs(process.argv)
      .help(false)
      .version(false)
      .parse();

  let maybeIp; let maybePort; let maybeOnStart;
  if (typeof args.ip === 'string') {
    maybeIp = args.ip;
  }
  if (typeof args.port === 'string' || typeof args.port === 'number') {
    maybePort = parseInt(String(args.port), 10);
  }

  if (args.help === true || args.h === true) {
    console.log('Node usage:');
    console.log('  --ip <ip address>      The ip address to bind the node to');
    console.log('  --port <port>          The port to bind the node to');
    console.log('  --config <config>      The serialized config string');
    process.exit(0);
  }

  if (typeof args.config === 'string') {
    let config = undefined;
    try {
      config = serialization.deserialize(args.config);
    } catch (error) {
      try {
        config = JSON.parse(args.config);
      } catch {
        console.error('Cannot deserialize config string: ' + args.config);
        process.exit(1);
      }
    }

    if (typeof config?.ip === 'string') {
      maybeIp = config?.ip;
    }
    if (typeof config?.port === 'number') {
      maybePort = config?.port;
    }
    if (typeof config?.onStart === 'function') {
      maybeOnStart = config?.onStart;
    }
  }

  maybeIp = maybeIp ?? '127.0.0.1';
  maybePort = maybePort ?? 1234;

  return {
    ip: maybeIp,
    port: maybePort,
    onStart: maybeOnStart,
  };
}
/**
 * @param {(err?: Error | null) => void} callback
 * @returns {void}
 */
function start(callback) {
  const existingServer = globalThis.distribution?.node?.server;
  if (existingServer && typeof existingServer.close === 'function' && existingServer.listening) {
    existingServer.close(() => start(callback));
    return;
  }

  const server = http.createServer((req, res) => {
    if (req.method !== 'PUT') {
      res.end(globalThis.distribution.util.serialize(
          new Error('Method not allowed!'),
      ));
      return;
    }


    const [,
      gid,
      serviceName,
      methodName,
    ] = url.parse(req.url).pathname.split('/');

    log(
        `[server] got request ${gid} ${serviceName}:${methodName} from ${req.socket.remoteAddress}`,
    );


    /** @type {any[]} */
    const body = [];

    req.on('data', (chunk) => {
      body.push(chunk);
    });

    req.on('end', () => {
      let payload;
      try {
        if (body.length === 0) {
          throw new Error('No body');
        }
        payload = Buffer.concat(body).toString();
      } catch (error) {
        res.end(globalThis.distribution.util.serialize([error]));
        return;
      }

      let message;
      try {
        message = globalThis.distribution.util.deserialize(payload);
      } catch (error) {
        res.end(globalThis.distribution.util.serialize([error, null]));
        return;
      }
      if (!Array.isArray(message)) {
        res.end(globalThis.distribution.util.serialize([
          new Error(`Invalid argument type, expected array, got ${typeof message}`),
        ]));
        return;
      }

      globalThis.distribution.local.routes.get(
          {service: serviceName, gid: gid},
          (error, service) => {
            if (error) {
              res.end(globalThis.distribution.util.serialize([error, null]));
              return;
            }
            if (!service[methodName]) {
              res.end(globalThis.distribution.util.serialize([
                new Error(`Method ${methodName} not found in service ${serviceName}`),
                null,
              ]));
              return;
            }

            log(
                `[server]  Calling service: ${serviceName}:${methodName} with args: ${JSON.stringify(message)}`,
            );

            if (message.length === 0 && service[methodName].length === 1) {
              message.push(undefined);
            }
            const method = service[methodName].bind(service);
            const normalized = globalThis.distribution.util.normalize(method, message);
            const done = (err, value) => {
              res.end(globalThis.distribution.util.serialize([err, value]));
            };
            try {
              method(...normalized, done);
            } catch (err) {
              done(err, null);
            }
          },
      );

    });
  });
  globalThis.distribution.node.server = server;
  const config = globalThis.distribution.node.config;

  server.once('listening', () => {
    log(`Server running at http://${config.ip}:${config.port}/`);
    callback(null);
  });

  let errored = false;
  let triedFallback = false;
  server.on('error', (error) => {
    if (errored) {
      return;
    }
    // Some environments disallow binding to 127.0.0.1; fallback to 0.0.0.0.
    if (!triedFallback &&
        (error?.code === 'EPERM' || error?.code === 'EADDRNOTAVAIL') &&
        config.ip === '127.0.0.1') {
      triedFallback = true;
      log(`Server error: ${error}. Retrying on 0.0.0.0`);
      server.listen(config.port, '0.0.0.0');
      return;
    }
    errored = true;
    log(`Server error: ${error}`);
    callback(error);
  });

  server.listen(config.port, config.ip);
}

module.exports = {start, config: setNodeConfig()};
