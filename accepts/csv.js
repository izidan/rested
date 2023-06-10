const stringify = require('csv-stringify');
const es = require('event-stream');
const _ = require('underscore');

const parse = JSON._parse || JSON.parse;

module.exports = baucis => {
  baucis.setFormatter('text/csv', singleOrArray);
  baucis.setFormatter('application/csv', singleOrArray);
  baucis.setFormatter('text/comma-separated-values', singleOrArray);
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
      var flat = flatten(d);
      Object.assign(header, flat);
      array.push(flat);
    }
    stringify(array, { header: false }, (err, output) => stream.emit('data', output.split('\n').splice(1).join('\n')));
  }, function () {
    const stream = this;
    stringify([header], { header: true }, (err, output) => {
      stream.emit('data', output.split('\n')[0]);
      stream.emit('end');
    });
  });
};

module.exports.stringify = stringify;

module.exports.flatten = flatten = function (obj, path, regex) {
  const d = {};
  path = path || '';
  regex = regex || /.*/;
  if ((obj == null) || (obj.constructor === Number) || (obj.constructor === Boolean) || (obj.constructor === String) || (obj.constructor === Date)) {
    var endPath = path.substr(0, path.length - 1);
    if (obj != null)
      if (obj.constructor === Date)
        d[endPath] = obj.toISOString();
      else if (!!path && path.match(regex))
        d[endPath] = obj;
      else if (!!!path)
        d[''] = obj;
  } else if (obj instanceof Array)
    obj.forEach((obji, i) => obji != null ? Object.assign(d, flatten(obji, `${path}${i}.`, regex)) : void 0);
  else if (obj instanceof Object)
    for (var i in obj)
      (obj[i] != null ? Object.assign(d, flatten(obj[i], `${path}${i}.`, regex)) : void 0);
  return d;
};