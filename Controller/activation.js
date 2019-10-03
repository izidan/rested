// __Dependencies__
const errors = require('http-errors');
require('../Controller');
// __Private Module Members__
// Expands route definitions based on generalized arguments.
const defineRoutes = (stage, params) => {
  let argumentsArray = Array.prototype.slice.call(params);
  let options = last(0, ['endpoint', 'methods', 'middleware'], argumentsArray);
  options.stage = stage;
  return factor(options);
};
// Handle variable number of arguments
const last = (skip, names, values) => {
  let r = {};
  let position = names.length;
  let count = values.filter(o => o !== undefined && o !== null).length - skip;
  if (count < 1) throw errors.InternalServerError('Too few arguments.');
  names.forEach(name => {
    let index = skip + count - position;
    position--;
    if (index >= skip) r[name] = values[index];
  });
  return r;
};
// Returns `true` if the given stirng is a recognized HTTP method.
const isRecognizedMethod = s => /^all|head|get|put|post|delete$/.exec(s) ? true : false;
// Parse middleware into an array of middleware definitions for each endpoint and method
const factor = options => {
  let methods;
  let factored = [];
  let methodString = options.methods;
  if (methodString) methodString = methodString.toLowerCase();
  if (!methodString || methodString === '*') methodString = 'all';
  methods = methodString.split(/\s+/);
  methods.forEach(method => { if (!isRecognizedMethod(method)) throw errors.InternalServerError(`Unrecognized HTTP method: "${method}"`) });
  if (!options.stage) throw errors.InternalServerError('The middleware stage was not provided');
  if (options.endpoint && options.endpoint !== 'instance' && options.endpoint !== 'collection')
    throw errors.InternalServerError(`End-point type must be either "instance" or "collection," not "${options.endpoint}"`);
  // Middleware function or array
  if (!Array.isArray(options.middleware) && typeof options.middleware !== 'function')
    throw errors.InternalServerError('Middleware must be an array or function');
  // Check endpoint is valid
  if (options.endpoint !== undefined && options.endpoint !== 'instance' && options.endpoint !== 'collection')
    throw errors.InternalServerError(`End-point type must be either "instance" or "collection," not "${options.endpoint}"`);
  // Add definitions for one or both endpoints, for each HTTP method.
  methods.forEach(method => {
    if (options.endpoint !== 'collection') factored.push({ stage: options.stage, endpoint: 'instance', method: method, middleware: options.middleware });
    if (options.endpoint !== 'instance') factored.push({ stage: options.stage, endpoint: 'collection', method: method, middleware: options.middleware });
  });
  return factored;
};
// __Module Definition__
module.exports = function (options, protect) {
  // __Private Instance Members__
  // A method used to activate middleware for a particular stage.
  activate = definition => {
    let stage = protect.controllerForStage[definition.stage];
    let f = stage[definition.method].bind(stage);
    if (definition.endpoint === 'instance') f('/:id', definition.middleware);
    else f('/', definition.middleware);
  };
  // __Protected Instance Members__
  protect.finalize = (...args) => {
    defineRoutes('finalize', args).forEach(activate);
    return this;
  };
  // __Public Instance Members__
  // A method used to activate request-stage middleware.
  this.request = (...args) => {
    defineRoutes('request', args).forEach(activate);
    return this;
  };
  // A method used to activate query-stage middleware.
  this.query = (...args) => {
    defineRoutes('query', args).forEach(activate);
    return this;
  };
};
