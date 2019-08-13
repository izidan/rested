const through = require('through2');
//const _ = require('underscore');

//const parse = JSON._parse || JSON.parse;

module.exports = function () {
  this.setFormatter('text/json', singleOrArray);
  this.setFormatter('application/json', singleOrArray);
}

const singleOrArray = function (alwaysArray) {
  let last, path, id;
  //if (this.controller && this.controller.model().path()) {
  //  path = this.controller.model().defaults.path.substr(0, this.controller.model().defaults.path.length - 1);
  //  id = this.controller.findBy();
  //}
  return through.obj(function (doc, enc, callback) {
    if (doc && doc.constructor.name === 'model')
      doc = JSON.parse(JSON.stringify(doc));
    alwaysArray = alwaysArray || (doc instanceof Array);
    doc = doc instanceof Array ? doc : doc !== undefined ? [doc] : undefined;
    if (alwaysArray && last === undefined && Array.isArray(doc))
      this.emit('data', '[');
    for (var d of doc) {
      // if (path)
      //   d = _.extract(d, id, path);
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