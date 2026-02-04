// @ts-check

/**
 * @param {any} object
 * @returns {string}
 */
function serialize(object) {
  return JSON.stringify(serializeValue(object));
}

/**
 * @param {any} object
 * @returns {any}
 */
function serializeValue(object) {
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

  if (objectType === 'function') {
    return {type: 'function', value: object.toString()};
  }

  if (objectType === 'object') {
    if (Array.isArray(object)) {
      return {
        type: 'array',
        value: object.map((item) => serializeValue(item)),
      };
    }

    if (object instanceof Date) {
      return {type: 'date', value: object.toISOString()};
    }

    if (object instanceof Error) {
      return {
        type: 'error',
        value: {
          name: object.name,
          message: object.message,
          stack: object.stack,
        },
      };
    }

    const value = {};
    for (const key of Object.keys(object)) {
      value[key] = serializeValue(object[key]);
    }
    return {type: 'object', value};
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
 * @param {string} string
 * @returns {any}
 */
function deserialize(string) {
  if (typeof string !== 'string') {
    throw new Error(`Invalid argument type: ${typeof string}.`);
  }

  const parsed = JSON.parse(string);
  return deserializeValue(parsed);
}

module.exports = {
  serialize,
  deserialize,
};
