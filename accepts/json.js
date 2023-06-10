const es = require('event-stream');
const _ = require('underscore');

const parse = JSON._parse || JSON.parse;

module.exports = baucis => {
  baucis.setFormatter('text/json', singleOrArray);
  baucis.setFormatter('application/json', singleOrArray);
}

const singleOrArray = function (alwaysArray) {
  let last, path, id;
  if (this.controller && this.controller.model() && this.controller.model().defaults && this.controller.model().defaults.path) {
    path = this.controller.model().defaults.path.substr(0, this.controller.model().defaults.path.length - 1);
    //id = this.controller.model().defaults.findBy || '_id';
  }
  return es.through(function (doc) {
    if (doc.constructor.name === 'model')
      doc = parse(JSON.stringify(doc));
    alwaysArray = alwaysArray | (doc instanceof Array);
    doc = doc instanceof Array ? doc : doc ? [doc] : undefined;
    if (alwaysArray && !last && doc)
      this.emit('data', '[');
    for (var d of doc) {
      if (path)
        d = _.extract(d, id, path);
      if (last)
        this.emit('data', ',');
      last = d || last || ' ';
      this.emit('data', JSON.stringify(d || null));
    }
  }, function () {
    if (alwaysArray && last)
      this.emit('data', ']');
    this.emit('end');
  });
};