// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").Hasher} Hasher
 */
const log = require('../util/log.js');


/**
 * @param {Function} func
 */
function createRPC(func) {
  if (typeof func !== 'function') {
    throw new Error('createRPC: func must be a function');
  }

  const routes = globalThis.distribution?.local?.routes;
  const comm = globalThis.distribution?.local?.comm;
  const nodeConfig = globalThis.distribution?.node?.config;

  if (!routes || !comm || !nodeConfig) {
    throw new Error('createRPC: distribution not initialized');
  }

  if (!globalThis.__rpcService) {
    globalThis.__rpcService = {
      serviceName: '__rpc__',
      methods: {},
    };
    routes.put(globalThis.__rpcService.methods, globalThis.__rpcService.serviceName, () => {});
  }

  const serviceName = globalThis.__rpcService.serviceName;
  const methods = globalThis.__rpcService.methods;
  const rpcId = `rpc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  methods[rpcId] = (/** @type {any[]} */ ...args) => {
    return func(...args);
  };

  const owner = {ip: nodeConfig.ip, port: nodeConfig.port};

  const rpcStub = (/** @type {any[]} */ ...args) => {
    const callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    const cb = callback || (() => {});
    return comm.send(args, {node: owner, service: serviceName, method: rpcId}, cb);
  };

  rpcStub.toString = () => {
    const ownerLiteral = JSON.stringify(owner);
    const serviceLiteral = JSON.stringify(serviceName);
    const methodLiteral = JSON.stringify(rpcId);
    return `function (...args) {
  const callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
  const cb = callback || function () {};
  return globalThis.distribution.local.comm.send(
    args,
    {node: ${ownerLiteral}, service: ${serviceLiteral}, method: ${methodLiteral}},
    cb
  );
}`;
  };

  return rpcStub;
}

/**
 * The toAsync function transforms a synchronous function that returns a value into an asynchronous one,
 * which accepts a callback as its final argument and passes the value to the callback.
 * @param {Function} func
 */
function toAsync(func) {

  const asyncFunc = (/** @type {any[]} */ ...args) => {
    const callback = args.pop();
    try {
      const result = func(...args);
      return callback(null, result);
    } catch (error) {
      return callback(error);
    }
  };

  asyncFunc.toString = () => func.toString();
  return asyncFunc;
}


module.exports = {
  createRPC,
  toAsync,
};
