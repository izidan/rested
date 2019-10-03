const from = require('from2');
const through = require('through2');
const errors = require('http-errors');

const validOperators = ['$set', '$push', '$pull', '$addToSet', '$pop', '$pushAll', '$pullAll'];

module.exports = function (options, protect) {
  const rested = require('../..');
  const checkBadUpdateOperatorPaths = (operator, paths) => {
    let whitelisted = this.operators(operator);
    if (!whitelisted) return true;
    let parts = whitelisted.split(/\s+/);
    return paths.some(path => parts.indexOf(path) !== -1 ? false : true);
  };
  // If there's a body, send it through any user-added streams.
  this.query('instance', 'put', (request, response, next) => {
    let count = 0;
    let operator = request.headers['update-operator'];
    let versionKey = this.model().schema.get('versionKey');
    let pipeline = protect.pipeline(next);
    // Check if the body was parsed by some external middleware e.g. `express.json`.
    // If so, create a one-document stream from the parsed body.
    if (request.body) {
      let documents = [].concat(request.body);
      pipeline(from.obj((size, nxt) => nxt(null, documents.shift() || null)));
    } else {
      // Otherwise, stream and parse the request.
      let parser = rested.parser(request.get('content-type'));
      if (!parser) return next(errors.UnsupportedMediaType());
      pipeline(request);
      pipeline(parser);
    }
    // Set up the stream context.
    pipeline((body, callback) => callback(null, { doc: undefined, incoming: body }));
    // Load the Mongoose document and add it to the context, unless this is a special update operator.
    if (!operator) pipeline((context, callback) =>
      this.model().findOne(request.rested.conditions).exec((error, doc) => {
        if (error) return callback(error);
        if (!doc) return callback(errors.NotFound('Nothing matched the requested query'));
        // Add the Mongoose document to the context.
        callback(null, { doc: doc, incoming: context.incoming });
      }));
    // Pipe through user streams, if any.
    pipeline(request.rested.incoming());
    // If the document ID is present, ensure it matches the ID in the URL.
    pipeline((context, callback) => {
      let bodyId = context.incoming[this.findBy()];
      if (bodyId === undefined) return callback(null, context);
      if (bodyId === request.params.id) return callback(null, context);
      callback(errors.UnprocessableEntity(`The ${this.findBy()} of the update document did not match the URL's document ID of "${bodyId}"`));
    });
    // Ensure the request includes a finite object version if locking is enabled.
    if (this.model().locking()) {
      pipeline((context, callback) =>
        context.incoming[versionKey] !== undefined && Number.isFinite(Number(context.incoming[versionKey])) ? callback(null, context) :
          callback(errors.UnprocessableEntity(`Locking is enabled, but the target version key "${versionKey}" was not provided in the request body`))
      );
      // Add some locking checks only applicable to the default update operator.
      if (!operator) {
        // Make sure the version key was selected.
        pipeline((context, callback) =>
          context.doc.isSelected(versionKey) ? callback(null, context) :
            callback(errors.BadRequest(`The version key "${versionKey}" must be selected`))
        );
        pipeline((context, callback) => {
          let updateVersion = Number(context.incoming[versionKey]);
          // Update and current version have been found. Check if they're equal.
          if (updateVersion !== context.doc[versionKey])
            return callback(errors.Conflict('The requested update would conflict with a previous update'));
          // One is not allowed to set __v and increment in the same update.
          delete context.incoming[versionKey];
          context.doc.increment();
          // Pass through.
          callback(null, context);
        });
      }
    }
    // Ensure there is exactly one update document.
    pipeline(through.obj(function (context, enc, callback) {
      ++count === 2 ? this.emit('error', errors.UnprocessableEntity('The request body contained more than one update document')) :
        count === 1 ? this.emit('data', context) : void 0;
      callback();
    }, function () {
      count > 0 ? this.emit('end') :
        this.emit('error', errors.UnprocessableEntity('The request body did not contain an update document'));
    }));
    // Finish up for the default update operator.
    if (!operator) {
      // Update the Mongoose document with the request body.
      pipeline((context, callback) => {
        context.doc.set(context.incoming);
        // Pass through.
        callback(null, context);
      });
      // Save the Mongoose document.
      pipeline((context, callback) => context.doc.save(callback));
    }
    // Finish up for a non-default update operator (bypasses validation).
    else
      pipeline((context, callback) => {
        let wrapper = {};
        if (validOperators.indexOf(operator) === -1)
          return callback(errors.NotImplemented(`The requested update operator "${operator}" is not supported`));
        // Ensure that some paths have been enabled for the operator.
        if (!this.operators(operator))
          return callback(errors.Forbidden(`The requested update operator "${operator}" is not enabled for this resource`));
        // Make sure paths have been whitelisted for this operator.
        if (checkBadUpdateOperatorPaths(operator, Object.keys(context.incoming)))
          return callback(errors.Forbidden(`This update path is forbidden for the requested update operator "${operator}"`));
        wrapper[operator] = context.incoming;
        if (this.model().locking())
          request.rested.conditions[versionKey] = Number(context.incoming[versionKey]);
        // Update the doc using the supplied operator and bypassing validation.
        this.model().updateOne(request.rested.conditions, wrapper, callback);
      });
    let s = pipeline();
    s.on('end', next);
    s.resume();
  });
};
