// @ts-check

/**
 * @param {any} object
 * @returns {string}
 */
function serialize(object) {
  const state = {
    nextId: 1,
    nodes: {},
    seen: new WeakMap(),
  };
  const root = serializeValue(object, state);
  return JSON.stringify({root, nodes: state.nodes});
}

/**
 * @param {any} object
 * @param {{nextId: number, nodes: Record<string, any>, seen: WeakMap<object, number>}} [state]
 * @returns {any}
 */
function serializeValue(object, state) {
  if (object === null) {
    return {type: 'null'};
  }

  const objectType = typeof object;
  if (objectType === 'undefined') {
    return {type: 'undefined'};
  }

  if (objectType === 'number') {
    return {type: 'number', value: object.toString()};
  }

  if (objectType === 'string') {
    return {type: 'string', value: object.toString()};
  }

  if (objectType === 'boolean') {
    return {type: 'boolean', value: object.toString()};
  }

  if (objectType === 'bigint') {
    return {type: 'bigint', value: object.toString()};
  }

  if (objectType === 'function') {
    if (!state) {
      return {type: 'function', value: object.toString()};
    }
    const existing = state.seen.get(object);
    if (existing) {
      return {type: 'ref', id: existing};
    }
    const id = state.nextId++;
    state.seen.set(object, id);
    const nativeId = getNativeFunctionId(object);
    if (nativeId) {
      state.nodes[id] = {type: 'native-function', value: nativeId};
    } else {
      state.nodes[id] = {type: 'function', value: object.toString()};
    }
    return {type: 'ref', id};
  }

  if (objectType === 'object') {
    if (Array.isArray(object)) {
      if (!state) {
        return {
          type: 'array',
          value: object.map((item) => serializeValue(item)),
        };
      }
      const existing = state.seen.get(object);
      if (existing) {
        return {type: 'ref', id: existing};
      }
      const id = state.nextId++;
      state.seen.set(object, id);
      state.nodes[id] = {
        type: 'array',
        value: object.map((item) => serializeValue(item, state)),
      };
      return {type: 'ref', id};
    }

    if (object instanceof Date) {
      if (!state) {
        return {type: 'date', value: object.toISOString()};
      }
      const existing = state.seen.get(object);
      if (existing) {
        return {type: 'ref', id: existing};
      }
      const id = state.nextId++;
      state.seen.set(object, id);
      state.nodes[id] = {type: 'date', value: object.toISOString()};
      return {type: 'ref', id};
    }

    if (object instanceof Error) {
      if (!state) {
        return {
          type: 'error',
          value: {
            name: object.name,
            message: object.message,
            stack: object.stack,
          },
        };
      }
      const existing = state.seen.get(object);
      if (existing) {
        return {type: 'ref', id: existing};
      }
      const id = state.nextId++;
      state.seen.set(object, id);
      state.nodes[id] = {
        type: 'error',
        value: {
          name: object.name,
          message: object.message,
          stack: object.stack,
        },
      };
      return {type: 'ref', id};
    }

    if (!state) {
      const value = {};
      for (const key of Object.keys(object)) {
        value[key] = serializeValue(object[key]);
      }
      return {type: 'object', value};
    }
    const existing = state.seen.get(object);
    if (existing) {
      return {type: 'ref', id: existing};
    }
    const id = state.nextId++;
    state.seen.set(object, id);
    const value = {};
    for (const key of Object.keys(object)) {
      value[key] = serializeValue(object[key], state);
    }
    state.nodes[id] = {type: 'object', value};
    return {type: 'ref', id};
  }

  return object;
}

/**
 * @param {any} parsed
 * @returns {any}
 */
function deserializeValue(parsed) {
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
    return parsed;
  }

  const type = typeof parsed.type === 'string' ? parsed.type.toLowerCase() : parsed.type;

  switch (type) {
    case 'null':
      return null;
    case 'undefined':
      return undefined;
    case 'number':
      return Number(parsed.value);
    case 'string':
      return String(parsed.value);
    case 'boolean':
      return parsed.value === true || parsed.value === 'true';
    case 'bigint':
      return BigInt(parsed.value);
    case 'function':
      return new Function(`return ${parsed.value}`)();
    case 'array':
      return Array.isArray(parsed.value) ?
        parsed.value.map((item) => deserializeValue(item)) :
        [];
    case 'object': {
      const object = {};
      if (parsed.value && typeof parsed.value === 'object') {
        for (const [key, value] of Object.entries(parsed.value)) {
          object[key] = deserializeValue(value);
        }
      }
      return object;
    }
    case 'date':
      return new Date(parsed.value);
    case 'error': {
      const payload = parsed.value && typeof parsed.value === 'object' ?
        parsed.value :
        {};
      const message = typeof payload.message === 'string' ? payload.message : undefined;
      const name = typeof payload.name === 'string' ? payload.name : 'Error';
      let err;
      switch (name) {
        case 'TypeError':
          err = new TypeError(message);
          break;
        case 'RangeError':
          err = new RangeError(message);
          break;
        case 'ReferenceError':
          err = new ReferenceError(message);
          break;
        case 'SyntaxError':
          err = new SyntaxError(message);
          break;
        case 'EvalError':
          err = new EvalError(message);
          break;
        case 'URIError':
          err = new URIError(message);
          break;
        case 'AggregateError':
          err = new AggregateError([], message);
          break;
        default:
          err = new Error(message);
          break;
      }
      if (parsed.value && typeof parsed.value === 'object') {
        if (typeof parsed.value.name === 'string') {
          err.name = parsed.value.name;
        }
        if (typeof parsed.value.stack === 'string') {
          err.stack = parsed.value.stack;
        }
      }
      return err;
    }
    default:
      throw new Error(`Unknown serialized type: ${String(parsed.type)}.`);
  }
}

/**
 * @param {{root: any, nodes: Record<string, any>}} payload
 * @returns {any}
 */
function deserializeGraph(payload) {
  const nodes = payload && payload.nodes && typeof payload.nodes === 'object' ?
    payload.nodes :
    {};
  const cache = new Map();

  const buildRef = (id) => {
    if (cache.has(id)) {
      return cache.get(id);
    }
    const node = nodes[id];
    if (!node || typeof node !== 'object') {
      return undefined;
    }
    const type = typeof node.type === 'string' ? node.type.toLowerCase() : node.type;
    let value;
    switch (type) {
      case 'array':
        value = [];
        cache.set(id, value);
        if (Array.isArray(node.value)) {
          for (const item of node.value) {
            value.push(deserializeValueWithRefs(item, buildRef));
          }
        }
        return value;
      case 'object':
        value = {};
        cache.set(id, value);
        if (node.value && typeof node.value === 'object') {
          for (const [key, item] of Object.entries(node.value)) {
            value[key] = deserializeValueWithRefs(item, buildRef);
          }
        }
        return value;
      case 'date':
        value = new Date(node.value);
        cache.set(id, value);
        return value;
      case 'error':
        value = deserializeValue({type: 'error', value: node.value});
        cache.set(id, value);
        return value;
      case 'function':
        value = new Function(`return ${node.value}`)();
        cache.set(id, value);
        return value;
      case 'native-function':
        value = getNativeFunctionById(node.value);
        cache.set(id, value);
        return value;
      default:
        return undefined;
    }
  };

  return deserializeValueWithRefs(payload.root, buildRef);
}

/**
 * @param {any} parsed
 * @param {(id: string) => any} buildRef
 * @returns {any}
 */
function deserializeValueWithRefs(parsed, buildRef) {
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
    return parsed;
  }
  const type = typeof parsed.type === 'string' ? parsed.type.toLowerCase() : parsed.type;
  if (type === 'ref') {
    return buildRef(String(parsed.id));
  }
  return deserializeValue(parsed);
}

/**
 * @param {string} string
 * @returns {any}
 */
function deserialize(string) {
  if (typeof string !== 'string') {
    throw new Error(`Invalid argument type: ${typeof string}.`);
  }

  const parsed = JSON.parse(string);
  if (parsed && typeof parsed === 'object' && 'root' in parsed && 'nodes' in parsed) {
    return deserializeGraph(parsed);
  }
  return deserializeValue(parsed);
}

/**
 * @param {Function} fn
 * @returns {string | null}
 */
function getNativeFunctionId(fn) {
  if (typeof fn !== 'function') {
    return null;
  }
  for (const entry of NATIVE_FUNCTIONS) {
    if (entry.fn === fn) {
      return entry.id;
    }
  }
  return null;
}

/**
 * @param {string} id
 * @returns {Function | undefined}
 */
function getNativeFunctionById(id) {
  for (const entry of NATIVE_FUNCTIONS) {
    if (entry.id === id) {
      return entry.fn;
    }
  }
  return undefined;
}

/**
 * @param {Function} fn
 * @returns {boolean}
 */
const NATIVE_FUNCTIONS = [
  {id: 'fs.readFile', fn: require('fs').readFile},
  {id: 'console.log', fn: require('console').log},
  {id: 'path.join', fn: require('path').join},
];

module.exports = {
  serialize,
  deserialize,
};
