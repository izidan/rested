// __Dependencies__
const express = require('express');
const util = require('util');
const es = require('event-stream');
const RestError = require('rest-error');

// __Private Module Members__
const validOperators = ['$set', '$push', '$pull', '$addToSet', '$pop', '$pushAll', '$pullAll'];

// __Module Definition__
module.exports = function (options, protect) {
  const baucis = require('../..');
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
    if (request.body) pipeline(es.readArray([request.body]));
    // Otherwise, stream and parse the request.
    else {
      let parser = baucis.parser(request.get('content-type'));
      if (!parser) return next(RestError.UnsupportedMediaType());
      pipeline(request);
      pipeline(parser);
    }
    // Set up the stream context.
    pipeline((body, callback) => callback(null, { doc: undefined, incoming: body }));
    // Load the Mongoose document and add it to the context, unless this is a
    // special update operator.
    if (!operator) pipeline((context, callback) =>
      this.model().findOne(request.baucis.conditions).exec((error, doc) => {
        if (error) return callback(error);
        if (!doc) return callback(RestError.NotFound());
        // Add the Mongoose document to the context.
        callback(null, { doc: doc, incoming: context.incoming });
      }));
    // Pipe through user streams, if any.
    pipeline(request.baucis.incoming());
    // If the document ID is present, ensure it matches the ID in the URL.
    pipeline((context, callback) => {
      let bodyId = context.incoming[this.findBy()];
      if (bodyId === undefined) return callback(null, context);
      if (bodyId === request.params.id) return callback(null, context);
      callback(RestError.UnprocessableEntity({ message: "The ID of the update document did not match the URL's document ID.", name: 'RestError', path: this.findBy(), value: bodyId }));
    });
    // Ensure the request includes a finite object version if locking is enabled.
    if (this.model().locking()) {
      pipeline((context, callback) =>
        context.incoming[versionKey] !== undefined && Number.isFinite(Number(context.incoming[versionKey])) ? callback(null, context) :
          callback(RestError.UnprocessableEntity({ message: 'Locking is enabled, but the target version was not provided in the request body.', name: 'RestError', path: versionKey }))
      );
      // Add some locking checks only applicable to the default update operator.
      if (!operator) {
        // Make sure the version key was selected.
        pipeline((context, callback) =>
          context.doc.isSelected(versionKey) ? callback(null, context) :
            callback(RestError.BadRequest('The version key "%s" must be selected', versionKey))
        );
        pipeline((context, callback) => {
          let updateVersion = Number(context.incoming[versionKey]);
          // Update and current version have been found.  Check if they're equal.
          if (updateVersion !== context.doc[versionKey]) return callback(RestError.LockConflict());
          // One is not allowed to set __v and increment in the same update.
          delete context.incoming[versionKey];
          context.doc.increment();
          // Pass through.
          callback(null, context);
        });
      }
    }
    // Ensure there is exactly one update document.
    pipeline(es.through(function (context) {
      ++count === 2 ? this.emit('error', RestError.UnprocessableEntity({ message: 'The request body contained more than one update document', name: 'RestError' })) :
        count === 1 ? this.emit('data', context) : void 0;
    }, function () {
      count > 0 ? this.emit('end') :
        this.emit('error', RestError.UnprocessableEntity({ message: 'The request body did not contain an update document', name: 'RestError' }));
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
          return callback(RestError.NotImplemented('The requested update operator "%s" is not supported', operator));
        // Ensure that some paths have been enabled for the operator.
        if (!this.operators(operator))
          return callback(RestError.Forbidden('The requested update operator "%s" is not enabled for this resource', operator));
        // Make sure paths have been whitelisted for this operator.
        if (checkBadUpdateOperatorPaths(operator, Object.keys(context.incoming)))
          return callback(RestError.Forbidden('This update path is forbidden for the requested update operator "%s"', operator));
        wrapper[operator] = context.incoming;
        if (this.model().locking())
          request.baucis.conditions[versionKey] = Number(context.incoming[versionKey]);
        // Update the doc using the supplied operator and bypassing validation.
        this.model().updateOne(request.baucis.conditions, wrapper, callback);
      });
    let s = pipeline();
    s.on('end', next);
    s.resume();
  });
};
