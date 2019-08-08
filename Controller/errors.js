// __Dependencies__
const es = require('event-stream');
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
    let scrape = /([^\s]+)[_]\d+\s+dup key: [{] : "([^"]+)" [}]/;
    let scraped = scrape.exec(error.message);
    let path = scraped ? scraped[1] : '???';
    let value = scraped ? scraped[2] : '???';
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
      let errors;
      if (!error.errors) errors = [error];
      else if (Array.isArray(error.errors) && error.errors.length !== 0) errors = error.errors;
      else errors = Object.keys(error.errors).map(key => error.errors[key]);
      if (errors.length === 0) errors = [error];
      errors = errors.map(error3 => {
        let o = {};
        Object.getOwnPropertyNames(error3).forEach(key => o[key] = error3[key]);
        if (o.stack) o.stack = o.stack.trim();
        delete o.domain;
        delete o.domainEmitter;
        delete o.domainThrown;
        return o;
      });
      // TODO deprecated -- always send as single error in 2.0.0
      let f = formatter(error instanceof RestError.UnprocessableEntity);
      f.on('error', next);
      es.readArray(errors).pipe(f).pipe(response);
    });
  });
};
