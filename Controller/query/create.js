const from = require('from2');
const through = require('through2');
const errors = require('http-errors');

module.exports = function (options, protect) {
  const rested = require('../..');
  const Model = this.model();
  this.query('post', (request, response, next) => {
    let pipeline = protect.pipeline(next);
    let url = request.originalUrl || request.url;
    let select = this.select().split(' ').filter(s => s && s[0] !== '-');
    let findBy = Object.keys(this.model().translateAliases({ [this.findBy()]: '' })).pop();
    let deselect = this.select().split(' ').filter(s => s && s[0] === '-').map(f => f.substr(1));
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
      let parser = rested.parser(request.get('content-type'));
      if (!parser) return next(errors.UnsupportedMediaType());
      pipeline(request);
      pipeline(parser);
    }
    // Create the stream context.
    pipeline((incoming, callback) => callback(null, { incoming: incoming, doc: null }));
    // Process the incoming document or documents.
    pipeline(request.rested.incoming());
    // Map function to create a document from incoming JSON and update the context.
    pipeline((context, callback) => {
      let transformed = { incoming: context.incoming };
      let type = context.incoming.__t;
      let Discriminator = type ? Model.discriminators[type] : undefined;
      if (type && !Discriminator)
        return callback(errors.UnprocessableEntity(`A document's type "${type}" did not match any known discriminators for this resource`));
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
    pipeline((context, callback) => {
      let doc = context.doc;
      if (select.length > 0)
        doc = select.reduce((obj, key) => ({ ...obj, [key]: context.doc.get(key) }), {});
      else if (deselect.length > 0)
        deselect.forEach((key) => context.doc.set(key, undefined));
      if (doc.toJSON)
        doc = doc.toJSON()
      callback(null, { _id: context.doc.get(findBy), doc: doc });
    });
    // Write the IDs to an array and process them.
    let s = pipeline();
    let docs = [];
    s.pipe(through.obj((context, enc, callback) => {
      docs.push(context);
      callback();
    }, () => {
      // Check for at least one document.
      if (docs.length === 0)
        return next(errors.UnprocessableEntity('The request body must contain at least one document'));
      // Set the conditions used to build `request.rested.query`.
      request.rested.documents = docs.length === 1 ? docs[0].doc : docs.map(d => d.doc);
      let ids = docs.map(d => d._id);
      let conditions = { $in: ids };
      // URL location of newly created document or documents.
      let location = url + '/' + ids[0];
      if (ids.length > 1)
        location = `${url}?conditions={"${findBy}":${JSON.stringify(conditions)}}`;
      // Set the `Location` header if at least one document was sent.
      response.set('Location', location);
      next();
    }));
    s.resume();
  });
};
