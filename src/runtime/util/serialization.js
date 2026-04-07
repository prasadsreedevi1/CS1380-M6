// @ts-check


/**
 * @param {any} object
 * @returns {string}
 */
function serialize(object) { // everything will be unified (e.g. 'type': 'number', 'string', etc.)
  const type = typeof object;

  // T2: Serialize and deserialize base types
  // Provide support for Number, String, Boolean, null, and undefined.

  if (object === null) {
    return JSON.stringify({type: 'null'});
  } else if (type === 'undefined') {
    return JSON.stringify({type: 'undefined'});
  } else if (type === 'number') {
    if (Number.isNaN(object)) {
      return JSON.stringify({type: 'NaN'});
    } else if (object === Infinity) {
      return JSON.stringify({type: 'Infinity'});
    } else if (object === -Infinity) {
      return JSON.stringify({type: '-Infinity'});
    } else {
      return JSON.stringify({type: 'number', value: object.toString()});
    }
  } else if (type === 'string') {
    return JSON.stringify({type: 'string', value: object});
  } else if (type === 'boolean') {
    return JSON.stringify({type: 'boolean', value: object});
  }

  // T3: Add support for functions (ONLY STATELESS)
  // Provide serialization and deserialization support for Function objects.
  else if (type === 'function') {
    return JSON.stringify({type: 'function', value: object.toString()});
  }

  // T4: Add support for complex, recursive structures[1]
  // Provide serialization and deserialization support for Object, Array, Error and Date structures.
  else if (Array.isArray(object)) {
    const arr = [];
    for (let i = 0; i < object.length; i++) {
      arr.push(JSON.parse(serialize(object[i])));
    }
    return JSON.stringify({type: 'array', value: arr});
  } else if (object instanceof Date) {
    return JSON.stringify({type: 'date', value: object.toISOString()});
  } else if (object instanceof Error) {
    return JSON.stringify({type: 'error', value: {name: object.name, message: object.message}});
  }
  // recursive structures handling

  else if (type === 'object') {
    const serializationObject = {};
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        serializationObject[key] = JSON.parse(serialize(object[key]));
      }
    }
    return JSON.stringify({type: 'object', value: serializationObject});
  }

  // E2: Support five native values
  // Provide support for console.log, fs.readFile, os.type, and any two other native values.
  // console.log
  else if (object === console.log) {
    return JSON.stringify({type: 'native function', value: 'function log() { [native code] }'});
  } else {
    throw new Error(`Unsupported type: ${type}.`);
  }
}


/**
 * @param {string} string
 * @returns {any}
 */
function deserialize(string) {
  let parsed;
  if (typeof string === 'string') {
    try {
      parsed = JSON.parse(string);
    } catch (error) {
      throw new SyntaxError('Malformed serialized string.');
    }
  } else if (typeof string === 'object' && string !== null && 'type' in string) {
    parsed = string;
  } else {
    throw new Error(`Invalid argument type: ${typeof string}.`);
  }

  // T2: Serialize and deserialize base types
  // Provide support for Number, String, Boolean, null, and undefined.

  const type = parsed.type;
  if (type === 'null') {
    return null;
  } else if (type === 'undefined') {
    return undefined;
  } else if (type === 'number') {
    return Number(parsed.value);
  } else if (type === 'NaN') {
    return NaN;
  } else if (type === 'Infinity') {
    return Infinity;
  } else if (type === '-Infinity') {
    return -Infinity;
  } else if (type === 'string') {
    return parsed.value;
  } else if (type === 'boolean') {
    if (typeof parsed.value === 'string') {
      if (parsed.value === 'true') return true;
      if (parsed.value === 'false') return false;
    }
    return parsed.value;
  }

  // T3: Add support for functions (ONLY STATELESS)
  // Provide serialization and deserialization support for Function objects.
  else if (type === 'function') {
    try {
      return new Function(`return (${parsed.value})`)();
    } catch (error) {
      // For native or unparsable functions, return a stub function that throws when invoked
      return function() {
        throw new Error('Deserialized function is not executable');
      };
    }
  }

  // T4: Add support for complex, recursive structures[1]
  // Provide serialization and deserialization support for Object, Array, Error and Date structures.
  else if (type === 'object') {
    const dataObject = {};
    for (const key in parsed.value) {
      if (Object.prototype.hasOwnProperty.call(parsed.value, key)) {
        dataObject[key] = deserialize(parsed.value[key]);
      }
    }
    return dataObject;
  } else if (type === 'array') {
    const arr = [];
    for (let i = 0; i < parsed.value.length; i++) arr.push(deserialize(parsed.value[i]));
    return arr;
  } else if (type === 'date') {
    return new Date(parsed.value);
  } else if (type === 'error') {
    const error = new Error(parsed.value.message);
    error.name = parsed.value.name;
    return error;
  } else {
    throw new Error(`Unknown serialized type: ${type}.`);
  }
}

module.exports = {
  serialize,
  deserialize,
};

