// __Dependencies__
const through = require('through2');
const Api = require('./Api');
const Controller = require('./Controller');
const Model = require('./Model');
const Query = require('./Query');
const HttpError = require('http-errors');
const Accept = require('./Accept');

let instance;
const parsers = {};
const formatters = {};

// __Module Definition__
const rested = module.exports = () => rested.empty();

// __Public Members__
rested.rest = model => {
  if (!instance) instance = Api();
  return instance.rest(model);
};

rested.empty = () => {
  let previous = instance;
  instance = Api();
  return previous;
};

rested.formatters = (response, callback) => {
  if (response._headerSent)
    return callback(null, () => through.obj(
      function (ctx, enc, cb) { console.trace(ctx); this.emit('data', ctx); cb() },
      function () { this.emit('end') }
    ));
  let handlers = { default: () => callback(HttpError.NotAcceptable()) };
  Object.keys(formatters).map(mime => handlers[mime] = formatters[mime](callback));
  response.format(handlers);
};

// Adds a formatter for the given mime type. Needs a function that returns a stream.
rested.setFormatter = (mime, f) => {
  formatters[mime] = callback => () => callback(null, f);
  return rested;
};

rested.parser = mime => {
  // Default to JSON when no MIME type is provided.
  mime = mime || 'application/json';
  // Not interested in any additional parameters at this point.
  mime = mime.split(';')[0].trim();
  let handler = parsers[mime];
  return handler ? handler() : undefined;
};

// Adds a parser for the given mime type. Needs a function that returns a stream.
rested.setParser = (mime, f) => {
  parsers[mime] = f;
  return rested;
};

// __Expose Modules__
rested.Api = Api;
rested.Model = Model;
rested.Error = HttpError;
rested.Controller = Controller;

Api.container(rested);
Controller.container(rested);
Model.container(rested);
Accept.apply(rested);

// __Plugins__
require('baucis-links').apply(rested);
