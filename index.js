// __Dependencies__
const deco = require('deco');
const es = require('event-stream');
const mongoose = require('mongoose');
const Api = require('./Api');
const Controller = require('./Controller');
const Model = require('./Model');
const Query = require('./Query');
const RestError = require('rest-error');
const plugins = { json: require('baucis-json'), links: require('baucis-links') };

let instance;
const parsers = {};
const formatters = {};

// __Module Definition__
const baucis = module.exports = () => baucis.empty();

// __Public Members__
baucis.rest = model => {
  if (!instance) instance = Api();
  return instance.rest(model);
};

baucis.empty = () => {
  let previous = instance;
  instance = Api();
  return previous;
};

baucis.formatters = (response, callback) => {
  if (response._headerSent)
    return callback(null, () => es.through(console.trace, function () { this.emit('end') }));
  let handlers = { default: () => callback(RestError.NotAcceptable()) };
  Object.keys(formatters).map(mime => handlers[mime] = formatters[mime](callback));
  response.format(handlers);
};

// Adds a formatter for the given mime type.  Needs a function that returns a stream.
baucis.setFormatter = (mime, f) => {
  formatters[mime] = callback => () => callback(null, f);
  return baucis;
};

baucis.parser = mime => {
  // Default to JSON when no MIME type is provided.
  mime = mime || 'application/json';
  // Not interested in any additional parameters at this point.
  mime = mime.split(';')[0].trim();
  let handler = parsers[mime];
  return handler ? handler() : undefined;
};

// Adds a parser for the given mime type. Needs a function that returns a stream.
baucis.setParser = (mime, f) => {
  parsers[mime] = f;
  return baucis;
};

// __Expose Modules__
baucis.Api = Api;
baucis.Controller = Controller;
baucis.Error = RestError;
baucis.Model = Model;

Api.container(baucis);
Controller.container(baucis);
RestError.container(baucis);
Model.container(baucis);

// __Plugins__
plugins.json.apply(baucis);
plugins.links.apply(baucis);
