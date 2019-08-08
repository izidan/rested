// __Dependencies__
const es = require('event-stream');
const util = require('util');
const domain = require('domain');
const RestError = require('rest-error');

// __Module Definition__
module.exports = function (options, protect) {
  const baucis = require('../..');
  const Model = this.model();
  this.query('post', (request, response, next) => {
    let findBy = this.findBy();
    let pipeline = protect.pipeline(next);
    let url = request.originalUrl || request.url;
    // Add trailing slash to URL if needed.
    if (url.lastIndexOf('/') === (url.length - 1)) url = url.slice(0, url.length - 1);
    // Set the status to 201 (Created).
    response.status(201);
    // Check if the body was parsed by some external middleware e.g. `express.json`.
    // If so, create a stream from the POST'd document or documents.
    if (request.body)
      pipeline(es.readArray([].concat(request.body)));
    // Otherwise, stream and parse the request.
    else {
      let parser = baucis.parser(request.get('content-type'));
      if (!parser) return next(RestError.UnsupportedMediaType());
      pipeline(request);
      pipeline(parser);
    }
    // Create the stream context.
    pipeline((incoming, callback) => callback(null, { incoming: incoming, doc: null }));
    // Process the incoming document or documents.
    pipeline(request.baucis.incoming());
    // Map function to create a document from incoming JSON and update the context.
    pipeline((context, callback) => {
      let transformed = { incoming: context.incoming };
      let type = context.incoming.__t;
      let Discriminator = type ? Model.discriminators[type] : undefined;
      if (type && !Discriminator)
        return callback(RestError.UnprocessableEntity({
          message: "A document's type did not match any known discriminators for this resource",
          name: 'RestError', path: '__t', value: type
        }));
      // Create the document using either the model or child model.
      if (type) transformed.doc = new Discriminator();
      else transformed.doc = new Model();
      // Transformation complete.
      callback(null, transformed);
    });
    // Update the new Mongoose document with the incoming data.
    pipeline((context, callback) => {
      context.doc.set(context.incoming);
      callback(null, context);
    });
    // Save each document.
    pipeline((context, callback) => context.doc.save((error, doc) => error ? next(error) : callback(null, { incoming: context.incoming, doc: doc })));
    // Map the saved documents to document IDs.
    pipeline((context, callback) => callback(null, context.doc.get(findBy)));
    // Write the IDs to an array and process them.
    let s = pipeline();
    s.pipe(es.writeArray((error, ids) => {
      if (error) return next(error);
      // URL location of newly created document or documents.
      let location;
      // Set the conditions used to build `request.baucis.query`.
      let conditions = request.baucis.conditions[findBy] = { $in: ids };
      // Check for at least one document.
      if (ids.length === 0)
        return next(RestError.UnprocessableEntity({ message: 'The request body must contain at least one document', name: 'RestError' }));
      // Set the `Location` header if at least one document was sent.
      if (ids.length === 1) location = url + '/' + ids[0];
      else location = util.format('%s?conditions={ "%s": %s }', url, findBy, JSON.stringify(conditions));
      response.set('Location', location);
      next();
    }));
    s.resume();
  });
};
