// __Dependencies__
const from = require('from2');
const mongoose = require('mongoose');
const RestError = require('rest-error');

// __Module Definition__
module.exports = function (options, protect) {
  const baucis = require('..');
  // A controller property that sets whether errors should be
  // handled if possible, or just set status code.
  protect.property('handleErrors', true, handle => handle ? true : false);
  // If it's a Mongo bad hint error, convert to a bad request error.
  protect.use((error, request, response, next) => {
    if (!error) return next();
    if (!error.message) return next(error);
    let message = 'The requested query hint is invalid'
    // Bad Mongo query hint (2.x).
    if (error.message === 'bad hint')
      return next(RestError.BadRequest(message));
    // Bad Mongo query hint (3.x).
    if (error.message.match('planner returned error: bad hint'))
      return next(RestError.BadRequest(message));
    if (!error.$err) return next(error);
    // Mongoose 3
    if (error.$err.match('planner returned error: bad hint'))
      return next(RestError.BadRequest(message));
    next(error);
  });
  // Convert Mongo duplicate key error to an unprocessible entity error
  protect.use((error, request, response, next) => {
    if (!error) return next();
    if (!error.message) return next(error);
    if (error.message.indexOf('E11000 duplicate key error') === -1) return next(error);
    let body = {};
    let scrape = /(?:([^\s]+)[_]\d+)?\s+dup key: { : "([^"]+)" }/;
    let scraped = scrape.exec(error.message) || [];
    let path = scraped[1] || '???';
    let value = scraped[2] || '???';
    body[path] = {
      message: `Path \`${path}\` (${value}) must be unique.`,
      originalMessage: error.message,
      name: 'MongoError',
      path: path,
      type: 'unique',
      value: value
    };
    let translatedError = RestError.UnprocessableEntity();
    translatedError.errors = body;
    next(translatedError);
  });
  // Convert Mongo validation errors to unprocessable entity errors.
  protect.use((error, request, response, next) => {
    if (!error) return next();
    if (!(error instanceof mongoose.Error.ValidationError)) return next(error);
    let newError = RestError.UnprocessableEntity();
    newError.errors = error.errors;
    next(newError);
  });
  // Convert Mongoose version conflict error to LockConflict.
  protect.use((error, request, response, next) => {
    if (!error) return next();
    if (!(error instanceof mongoose.Error.VersionError)) return next(error);
    next(RestError.LockConflict());
  });
  // Translate other errors to internal server errors.
  protect.use((error, request, response, next) => {
    if (!error) return next();
    if (error instanceof RestError) return next(error);
    let error2 = RestError.InternalServerError(error.message);
    error2.stack = error.stack;
    next(error2);
  });
  // Format the error based on the Accept header.
  protect.use((error, request, response, next) => {
    if (!error) return next();
    // Always set the status code if available.
    if (error.status >= 100)
      response.status(error.status);
    if (!this.handleErrors()) return next(error);
    baucis.formatters(response, (error2, formatter) => {
      if (error2) return next(error2);
      let errors = error.errors || [error];
      if (!Array.isArray(errors))
        errors = Object.keys(errors).map(key => errors[key]);
      errors = errors.map(err => {
        let o = {};
        Object.getOwnPropertyNames(err).forEach(key => o[key] = err[key]);
        if (o.stack) o.stack = o.stack.trim();
        delete o.domainEmitter;
        delete o.domainThrown;
        delete o.domain;
        return o;
      });
      // Always send as single error
      errors = [errors.shift() || error, null];
      let f = formatter(false);
      f.on('error', next);
      from.obj((size, next) => next(null, errors.shift())).pipe(f).pipe(response);
    });
  });
};
