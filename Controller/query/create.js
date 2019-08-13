const util = require('util');
const from = require('from2');
const through = require('through2');
const RestError = require('rest-error');

module.exports = function (options, protect) {
  const baucis = require('../..');
  const Model = this.model();
  this.query('post', (request, response, next) => {
    let findBy = this.findBy();
    let pipeline = protect.pipeline(next);
    let url = request.originalUrl || request.url;
    let select = this.select().split(' ').filter(s => s && s[0] !== '-');
    // Add trailing slash to URL if needed.
    if (url.lastIndexOf('/') === (url.length - 1)) url = url.slice(0, url.length - 1);
    // Set the status to 201 (Created).
    response.status(201);
    // Check if the body was parsed by some external middleware e.g. `express.json`.
    // If so, create a stream from the POST'd document or documents.
    if (request.body) {
      let documents = [].concat(request.body);
      pipeline(from.obj((size, nxt) => nxt(null, documents.shift() || null)));
    } else {
      // Otherwise, stream and parse the request.
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
    //pipeline((context, callback) => callback(null, context.doc.get(findBy)));
    pipeline((context, callback) => callback(null, {
      _id: context.doc.get(findBy),
      doc: select.length === 0 ? context.doc.toJSON() : select.reduce((obj, key) => ({ ...obj, [key]: context.doc.get(key) }), {})
    }));
    // Write the IDs to an array and process them.
    let s = pipeline();
    let docs = [];
    s.pipe(through.obj((context, enc, callback) => {
      docs.push(context);
      callback();
    }, () => {
      // Check for at least one document.
      if (docs.length === 0)
        return next(RestError.UnprocessableEntity({ message: 'The request body must contain at least one document', name: 'RestError' }));
      // Set the conditions used to build `request.baucis.query`.
      request.baucis.documents = docs.length === 1 ? docs[0].doc : docs.map(d => d.doc);
      let ids = docs.map(d => d._id);
      let conditions = { $in: ids };
      // URL location of newly created document or documents.
      let location = url + '/' + ids[0];
      if (ids.length > 1)
        location = util.format('%s?conditions={"%s":%s}', url, findBy, JSON.stringify(conditions));
      // Set the `Location` header if at least one document was sent.
      response.set('Location', location);
      next();
    }));
    s.resume();
  });
};
