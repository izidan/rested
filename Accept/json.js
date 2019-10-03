const through = require('through2');
const errors = require('http-errors');

module.exports = function () {
  this.setParser('application/json', parser);
  this.setFormatter('application/json', singleOrArray);

  this.setParser('text/json', parser);
  this.setFormatter('text/json', singleOrArray);
}

const singleOrArray = function (alwaysArray) {
  let last;
  return through.obj(function (doc, enc, callback) {
    if (doc && doc.constructor.name === 'model')
      doc = JSON.parse(JSON.stringify(doc));
    alwaysArray = alwaysArray || (doc instanceof Array);
    doc = doc instanceof Array ? doc : doc !== undefined ? [doc] : undefined;
    if (alwaysArray && last === undefined && Array.isArray(doc))
      this.emit('data', '[');
    for (var d of doc) {
      if (last !== undefined)
        this.emit('data', ',');
      last = d;
      this.emit('data', JSON.stringify(d));
    }
    callback();
  }, function () {
    if (alwaysArray)
      this.emit('data', ']');
    this.emit('end');
  });
};

// Default parser.  Parses incoming JSON string into an object or objects.
// Works whether an array or single object is sent as the request body.  
// It's very lenient with input outside of first-level braces.  
// This means that a collection of JSON objects can be sent in different ways 
// e.g. separated by whitespace or in a JSON-compatible array with objects split by commas.
const parser = function () {
  var depth = 0;
  var buffer = '';

  return through.obj(function (chunk, enc, callback) {
    var match;
    var head;
    var brace;
    var tail;
    var emission;
    var remaining = chunk.toString();
    while (remaining !== '') {
      match = remaining.match(/[\}\{]/);
      // The head of the string is all characters up to the first brace, if any.
      head = match ? remaining.substr(0, match.index) : remaining;
      // The first brace in the string, if any.
      brace = match ? match[0] : '';
      // The rest of the string, following the brace.
      tail = match ? remaining.substr(match.index + 1) : '';

      if (depth === 0) {
        // The parser is outside an object.
        // Ignore the head of the string.
        // Add brace if it's an open brace.
        if (brace === '{') {
          depth += 1;
          buffer += brace;
        }
      }
      else {
        // The parser is inside an object.
        // Add the head of the string to the buffer.
        buffer += head;
        // Increase or decrease depth if a brace was found.
        if (brace === '{') depth += 1;
        else if (brace === '}') depth -= 1;
        // Add the brace to the buffer.
        buffer += brace;
        // If the object ended, emit it.
        if (depth === 0) {
          try {
            emission = JSON.parse(buffer);
          }
          catch (error) {
            this.emit('error', errors.BadRequest(`The body of this request was invalid and could not be parsed. "${error.message}"`));
          }

          this.emit('data', emission);
          buffer = '';
        }
      }
      // Move on to the unprocessed remainder of the string.
      remaining = tail;
    }
    callback();
  });
}