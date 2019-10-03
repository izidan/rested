const through = require('through2');
const crypto = require('crypto');
const from = require('from2');

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
  return through.obj(function (chunk, enc, callback) {
    hash.update(chunk);
    this.emit('data', chunk);
    callback();
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
  return through.obj(function (chunk, enc, callback) {
    hash.update(JSON.stringify(chunk));
    response.set('Etag', '"' + hash.digest('hex') + '"');
    this.emit('data', chunk);
    callback();
  }, function () { this.emit('end'); });
};
// Generate a Last-Modified header/trailer
const lastModified = (response, lastModifiedPath, useTrailer) => {
  if (useTrailer) {
    addTrailer(response, 'Last-Modified');
    response.set('Transfer-Encoding', 'chunked');
  }
  let latest = null;
  return through.obj(function (context, enc, callback) {
    if (!context) return callback();
    if (!context.get) {
      this.emit('data', context);
      return callback();
    }
    //if (!context.doc) return this.emit('data', context);
    //if (!context.doc.get) return this.emit('data', context);
    //let current = context.doc.get(lastModifiedPath);
    let current = context.get(lastModifiedPath);
    if (latest === null) latest = current;
    else latest = new Date(Math.max(latest, current));
    if (!useTrailer)
      response.set('Last-Modified', latest.toUTCString());
    this.emit('data', context);
    callback();
  }, function () {
    if (useTrailer && latest)
      response.addTrailers({ 'Last-Modified': latest.toUTCString() });
    this.emit('end');
  });
};

module.exports = function (options, protect) {
  const rested = require('..');
  const lastModifiedPath = this.model().lastModified();
  // If counting get the count and send it back directly.
  protect.finalize((request, response, next) => {
    if (!request.rested.count) return next();
    if (!Array.isArray(request.rested.documents))
      return request.rested.query.count((error, n) => {
        if (!error)
          request.rested.documents = n;
        next(error);
      });
    request.rested.documents = request.rested.documents.length;
    next();
  });
  // If not counting, create the basic stream pipeline.
  protect.finalize('collection', 'all', (request, response, next) => {
    let count = 0;
    let documents = request.rested.documents;
    let pipeline = request.rested.send = protect.pipeline(next);
    // If documents were set in the hash, use them.
    if (documents !== undefined) pipeline(from.obj((size, nxt) => {
      let chunk = documents !== undefined ? documents : null;
      documents = undefined;
      nxt(null, chunk);
    }));
    // Otherwise, stream the relevant documents from Mongo, based on constructed query.
    else pipeline(request.rested.query.cursor());
    // Check for not found.
    pipeline(through.obj(
      function (context, enc, callback) { ++count; this.emit('data', context); callback() },
      function () {
        if (count === 0)
          response.status(204, { 'Cache-Control': 'no-cache, no-store' });
        this.emit('end');
      }));
    // Apply user streams.
    pipeline(request.rested.outgoing());
    // Set the document formatter based on the Accept header of the request.
    rested.formatters(response, (error, formatter) => {
      if (!error) request.rested.formatter = formatter;
      next(error);
    });
  });

  protect.finalize('instance', 'all', (request, response, next) => {
    let count = 0;
    let documents = request.rested.documents;
    let pipeline = request.rested.send = protect.pipeline(next);
    // If documents were set in the hash, use them.
    if (documents !== undefined) pipeline(from.obj((size, nxt) => {
      let chunk = documents !== undefined ? documents : null;
      documents = undefined;
      nxt(null, chunk);
    }));
    // Otherwise, stream the relevant documents from Mongo, based on constructed query.
    else pipeline(request.rested.query.cursor());
    // Check for not found.
    pipeline(through.obj(
      function (context, enc, callback) { ++count; this.emit('data', context); callback() },
      function () {
        if (count === 0)
          response.status(204, { 'Cache-Control': 'no-cache, no-store' });
        this.emit('end');
      }));
    // Apply user streams.
    pipeline(request.rested.outgoing());
    // Set the document formatter based on the Accept header of the request.
    rested.formatters(response, (error, formatter) => {
      if (!error) request.rested.formatter = formatter;
      next(error);
    });
  });

  // OPTIONS // TODO Express' extra handling for OPTIONS conflicts
  // TODO maybe send method names in body
  // controller.options(function (request, response, next) {
  //   console.log('here')
  //   request.rested.send(empty);
  //   next();
  // });

  // HEAD
  protect.finalize('instance', 'head', (request, response, next) => {
    if (lastModifiedPath)
      request.rested.send(lastModified(response, lastModifiedPath, false));
    request.rested.send(etagImmediate(response));
    request.rested.send(request.rested.formatter());
    request.rested.send(empty);
    next();
  });
  // HEAD*
  protect.finalize('collection', 'head', (request, response, next) => {
    if (lastModifiedPath)
      request.rested.send(lastModified(response, lastModifiedPath, false));
    request.rested.send(request.rested.formatter(true));
    request.rested.send(etag(response, false));
    request.rested.send(empty);
    next();
  });
  // GET
  protect.finalize('instance', 'get', (request, response, next) => {
    if (lastModifiedPath)
      request.rested.send(lastModified(response, lastModifiedPath, false));
    request.rested.send(etagImmediate(response));
    request.rested.send(request.rested.formatter());
    next();
  });
  // GET*
  protect.finalize('collection', 'get', (request, response, next) => {
    if (lastModifiedPath)
      request.rested.send(lastModified(response, lastModifiedPath, true));
    /* ERR_HTTP_TRAILER_INVALID]: Trailers are invalid with this transfer encoding
     * https://github.com/wprl/baucis/issues/330 */
    //request.rested.send(etag(response, true));
    request.rested.send(request.rested.formatter(request.rested.documents === undefined));
    next();
  });
  // POST
  protect.finalize('collection', 'post', (request, response, next) => {
    request.rested.send(request.rested.formatter());
    next();
  });
  // PUT
  protect.finalize('put', (request, response, next) => {
    request.rested.send(request.rested.formatter());
    next();
  });
  // DELETE
  protect.finalize('delete', (request, response, next) => {
    let deleted = 0;
    // Remove each document from the database.
    request.rested.send((context, callback) => context.deleteOne(callback));
    // Respond with the count of deleted documents.
    request.rested.send(through.obj(
      (context, enc, callback) => ++deleted && callback(),
      function () { this.emit('data', deleted); this.emit('end'); }));
    request.rested.send(request.rested.formatter());
    next();
  });
  // STREAM OUT
  protect.finalize((request, response, next) => {
    let stream = request.rested.send();
    let query = stream.domain.members[0];
    response.on('drain', () => query.resume());
    response.on('close', () =>
      query.cursor && query.cursor.cursorId && query.cursor.cursorState.killed === false ?
        (query.close || query.destroy || void 0)() : query.pause());
    stream.on('error', next);
    stream.pipe(through.obj(
      (chunk, enc, callback) => {
        if (response.finished !== true && response.write(chunk) === false)
          query.pause();
        callback();
      },
      function () { response.end(); this.emit('end'); }));
  });
};
