const es = require('event-stream');
const _ = require('underscore');
const csv = require('./csv');

const parse = JSON._parse || JSON.parse;

module.exports = baucis => {
  baucis.setFormatter('text/tsv', singleOrArray);
  baucis.setFormatter('application/tsv', singleOrArray);
  baucis.setFormatter('text/tab-separated-values', singleOrArray);
};

const singleOrArray = function (alwaysArray) {
  let path, id;
  const header = {};
  if (this.controller && this.controller.model() && this.controller.model().defaults && this.controller.model().defaults.path) {
    path = this.controller.model().defaults.path.substr(0, this.controller.model().defaults.path.length - 1);
    //id = this.controller.model().defaults.findBy || '_id';
  }
  return es.through(function (doc) {
    const stream = this;
    const array = [header];
    if (doc.constructor.name === 'model')
      doc = parse(JSON.stringify(doc));
    doc = doc instanceof Array ? doc : doc ? [doc] : undefined;
    for (var d of doc) {
      if (path)
        d = _.extract(d, id, path);
      var flat = csv.flatten(d);
      Object.assign(header, flat);
      array.push(flat);
    }
    csv.stringify(array, { header: false, delimiter: '\t' }, (err, output) => stream.emit('data', output.split('\n').splice(1).join('\n')));
  }, function () {
    const stream = this;
    csv.stringify([header], { header: true, delimiter: '\t' }, (err, output) => {
      stream.emit('data', output.split('\n')[0]);
      stream.emit('end');
    });
  });
};