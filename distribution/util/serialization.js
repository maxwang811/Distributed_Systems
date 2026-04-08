// @ts-check

/**
 * @param {any} object
 * @returns {string}
 */
function serialize(object) {
  return JSON.stringify(encodeValue(object));
}

function resolvePath(path) {
  const nativeMap = {
    'console.log': console.log,
    'fs.readFile': require('fs').readFile,
    'fs.writeFile': require('fs').writeFile,
    'os.type': require('os').type,
    'path.resolve': require('path').resolve,
  };
  return nativeMap[path];
}

function encodeValue(object) {
  if (object === null) {
    return {'type': 'null', 'value': null};
  }

  if (object === undefined) {
    return {'type': 'undefined', 'value': null};
  }

  if (object === Infinity) {
    return {'type': 'number', 'value': 'Infinity'};
  }

  switch (typeof(object)) {
    case 'number':
      return {'type': 'number', 'value': object.toString()};
    case 'bigint':
      return {'type': 'bigint', 'value': object.toString()};
    case 'string':
      return {'type': 'string', 'value': object.toString()};
    case 'boolean':
      return {'type': 'boolean', 'value': object.toString()};
    case 'function':
      if (object.toString() === 'function () { [native code] }') {
        return {'type': 'native', 'value': 'console.log'};
      } else if (object.toString().includes('function readFile(path, options, callback)')) {
        return {'type': 'native', 'value': 'fs.readFile'};
      } else if (object.toString() === '() => type') {
        return {'type': 'native', 'value': 'os.type'};
      } else if (object.toString().includes('function writeFile(path, data, options, callback)')) {
        return {'type': 'native', 'value': 'fs.writeFile'};
      } else if (object.toString().includes('resolve(...args) {')) {
        return {'type': 'native', 'value': 'path.resolve'};
      }
      return {'type': 'function', 'value': object.toString()};
    case 'object':
      if (object instanceof Date) {
        return {'type': 'date', 'value': object.toISOString()};
      }
      if (object instanceof Error) {
        return {'type': 'error',
          'value': encodeValue({'name': object.name, 'message': object.message, 'cause': object.cause})};
      }
      if (Object.getPrototypeOf(object) === Object.prototype) { // basic js objects like {}, {'a': 1}
        const val = {};
        for (const key of Object.keys(object)) {
          val[key] = encodeValue(object[key]);
        }
        return {'type': 'object', 'value': val};
      }
      if (object instanceof Array) {
        const val = {};
        for (let i = 0; i < object.length; i++) {
          val[i] = encodeValue(object[i]);
        }

        return {'type': 'array', 'value': val};
      }
      break;
    default:
      throw new Error(`Serialize not implemented for type ${typeof(object)}`);
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
  const json = JSON.parse(string);

  return decodeValue(json);
}

/**
 * @param {JSON} json
 * @returns {any}
 */
function decodeValue(json) {
  if (json === null) {
    return null;
  }
  if (json === undefined) {
    return undefined;
  }

  switch (json['type']) {
    case 'null':
      return null;
    case 'undefined':
      return undefined;
    case 'number':
      if (json['value'] === 'Infinity') {
        return Infinity;
      }
      return parseFloat(json['value']);
    case 'bigint':
      return BigInt(json['value']);
    case 'string':
      return json['value'];
    case 'boolean':
      return json['value'] === 'true';
    case 'function':
      const body = json['value'];
      return new Function(`return ${body}`)();
    case 'native':
      return resolvePath(json['value']);
    case 'error':
      const errData = decodeValue(json['value']);
      const err = new Error(errData['message'], {cause: errData['cause']});
      err.name = errData['name'];
      return err;
    case 'date':
      return new Date(json['value']);
    case 'array':
      const list = [];
      const serializedList = json['value'];
      for (const value of Object.values(serializedList)) {
        list.push(decodeValue(value));
      }
      return list;
    case 'object':
      const obj = {};
      const serializedObj = json['value'];
      for (const key of Object.keys(serializedObj)) {
        obj[key] = decodeValue(serializedObj[key]);
      }
      return obj;
    default:
      throw new SyntaxError(`Deserialize not implemented for type ${json['type']}`);
  }
}

module.exports = {
  serialize,
  deserialize,
};
