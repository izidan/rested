const through = require('through2');

module.exports = function () {
  this.setFormatter('text/json', singleOrArray);
  this.setFormatter('application/json', singleOrArray);
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