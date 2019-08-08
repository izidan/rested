// __Dependencies__
const es = require('event-stream');
const crypto = require('crypto');
const RestError = require('rest-error');
// __Private Module Members__
// Format the Trailer header.
const addTrailer = (response, header) => {
  let current = response.get('Trailer');
  if (!current) response.set('Trailer', header);
  else response.set('Trailer', current + ', ' + header);
};
// A map that is used to create empty response body.
const empty = (context, callback) => callback(null, '');
// Generate a respone Etag from a context.
const etag = (response, useTrailer) => {
  if (useTrailer) {
    addTrailer(response, 'Etag');
    response.set('Transfer-Encoding', 'chunked');
  }
  let hash = crypto.createHash('md5');
  return es.through(function (chunk) {
    hash.update(chunk);
    this.emit('data', chunk);
  }, function () {
    if (useTrailer)
      response.addTrailers({ 'Etag': '"' + hash.digest('hex') + '"' });
    else
      response.set('Etag', '"' + hash.digest('hex') + '"');
    this.emit('end');
  });
};
// Generate an immediate respone Etag from a context.
const etagImmediate = (response) => {
  let hash = crypto.createHash('md5');
  return es.through(function (chunk) {
    hash.update(JSON.stringify(chunk));
    response.set('Etag', '"' + hash.digest('hex') + '"');
    this.emit('data', chunk);
  }, function () { this.emit('end'); });
};
// Generate a Last-Modified header/trailer
const lastModified = (response, lastModifiedPath, useTrailer) => {
  if (useTrailer) {
    addTrailer(response, 'Last-Modified');
    response.set('Transfer-Encoding', 'chunked');
  }
  let latest = null;
  return es.through(function (context) {
    if (!context) return;
    if (!context.get) return this.emit('data', context);
    //if (!context.doc) return this.emit('data', context);
    //if (!context.doc.get) return this.emit('data', context);
    //let current = context.doc.get(lastModifiedPath);
    let current = context.get(lastModifiedPath);
    if (latest === null) latest = current;
    else latest = new Date(Math.max(latest, current));
    if (!useTrailer)
      response.set('Last-Modified', latest.toUTCString());
    this.emit('data', context);
  }, function () {
    if (useTrailer && latest)
      response.addTrailers({ 'Last-Modified': latest.toUTCString() });
    this.emit('end');
  });
};
// Build a reduce stream.
const reduce = (accumulated, f) =>
  es.through((context) => accumulated = f(accumulated, context), function () {
    this.emit('data', accumulated);
    this.emit('end');
  });
// Count emissions.
const count = () => reduce(0, a => ++a);


// __Module Definition__
module.exports = function (options, protect) {
  const baucis = require('..');
  const lastModifiedPath = this.model().lastModified();
  // If counting get the count and send it back directly.
  protect.finalize((request, response, next) => {
    if (!request.baucis.count) return next();
    request.baucis.query.count((error, n) => {
      if (error) return next(error);
      response.removeHeader('Transfer-Encoding');
      return response.json(n); // TODO support other content types
    });
  });
  // If not counting, create the basic stream pipeline.
  protect.finalize('collection', 'all', (request, response, next) => {
    let count = 0;
    let documents = request.baucis.documents;
    let pipeline = request.baucis.send = protect.pipeline(next);
    // If documents were set in the baucis hash, use them.
    if (documents) pipeline(es.readArray([].concat(documents)));
    // Otherwise, stream the relevant documents from Mongo, based on constructed query.
    else pipeline(request.baucis.query.cursor());
    // Check for not found.
    pipeline(es.through(
      function (context) { ++count && this.emit('data', context); },
      function () {
        if (count === 0)
          response.status(204, { 'Cache-Control': 'no-cache, no-store' });
        this.emit('end');
      }));
    // Apply user streams.
    pipeline(request.baucis.outgoing());
    // Set the document formatter based on the Accept header of the request.
    baucis.formatters(response, (error, formatter) => {
      if (!error) request.baucis.formatter = formatter;
      next(error);
    });
  });

  protect.finalize('instance', 'all', (request, response, next) => {
    let count = 0;
    let documents = request.baucis.documents;
    let pipeline = request.baucis.send = protect.pipeline(next);
    // If documents were set in the baucis hash, use them.
    if (documents) pipeline(es.readArray([].concat(documents)));
    // Otherwise, stream the relevant documents from Mongo, based on constructed query.
    else pipeline(request.baucis.query.cursor());
    // Check for not found.
    pipeline(es.through(
      function (context) { ++count && this.emit('data', context); },
      function () {
        if (count === 0)
          response.status(204, { 'Cache-Control': 'no-cache, no-store' });
        this.emit('end');
      }));
    // Apply user streams.
    pipeline(request.baucis.outgoing());
    // Set the document formatter based on the Accept header of the request.
    baucis.formatters(response, (error, formatter) => {
      if (!error) request.baucis.formatter = formatter;
      next(error);
    });
  });

  // OPTIONS // TODO Express' extra handling for OPTIONS conflicts with baucis
  // TODO maybe send method names in body
  // controller.options(function (request, response, next) {
  //   console.log('here')
  //   request.baucis.send(empty);
  //   next();
  // });

  // HEAD
  protect.finalize('instance', 'head', (request, response, next) => {
    if (lastModifiedPath)
      request.baucis.send(lastModified(response, lastModifiedPath, false));
    request.baucis.send(etagImmediate(response));
    request.baucis.send(request.baucis.formatter());
    request.baucis.send(empty);
    next();
  });
  // HEAD*
  protect.finalize('collection', 'head', (request, response, next) => {
    if (lastModifiedPath)
      request.baucis.send(lastModified(response, lastModifiedPath, false));
    request.baucis.send(request.baucis.formatter(true));
    request.baucis.send(etag(response, false));
    request.baucis.send(empty);
    next();
  });
  // GET
  protect.finalize('instance', 'get', (request, response, next) => {
    if (lastModifiedPath)
      request.baucis.send(lastModified(response, lastModifiedPath, false));
    request.baucis.send(etagImmediate(response));
    request.baucis.send(request.baucis.formatter());
    next();
  });
  // GET*
  protect.finalize('collection', 'get', (request, response, next) => {
    if (lastModifiedPath)
      request.baucis.send(lastModified(response, lastModifiedPath, true));
    /* ERR_HTTP_TRAILER_INVALID]: Trailers are invalid with this transfer encoding
     * https://github.com/wprl/baucis/issues/330 */
    //request.baucis.send(etag(response, true));
    request.baucis.send(request.baucis.formatter(true));
    next();
  });
  // POST
  protect.finalize('collection', 'post', (request, response, next) => {
    request.baucis.send(request.baucis.formatter());
    next();
  });
  // PUT
  protect.finalize('put', (request, response, next) => {
    request.baucis.send(request.baucis.formatter());
    next();
  });
  // DELETE
  protect.finalize('delete', (request, response, next) => {
    // Remove each document from the database.
    request.baucis.send((context, callback) => context.deleteOne(callback));
    // Respond with the count of deleted documents.
    request.baucis.send(count());
    request.baucis.send(es.stringify());
    next();
  });
  // STREAM OUT
  protect.finalize((request, response, next) => {
    let stream = request.baucis.send();
    let query = stream.domain.members[0];
    response.on('drain', () => query.resume());
    response.on('close', () =>
      query.cursor && query.cursor.cursorId && query.cursor.cursorState.killed === false ?
        (query.close || query.destroy || void 0)() : query.pause());
    stream.on('error', next);
    stream.pipe(es.through(
      chunk => response.finished != true && response.write(chunk) == false ? query.pause() : null,
      function () { response.end(); this.emit('end'); }));
  });
};
