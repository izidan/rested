const es = require('event-stream');
const express = require('express');
const _ = require('underscore');

const parse = JSON._parse || JSON.parse;

const datetime = /("\d{4}-\d{2}-\d{2}[T|\s]\d{2}:\d{2}:\d{2}.*?")/g;

express.static.mime.define({
  'application/javascript': ['jsonp'],
});

module.exports = baucis => {
  baucis.setFormatter('application/js', singleOrArray);
  baucis.setFormatter('application/jsonp', singleOrArray);
  baucis.setFormatter('application/javascript', singleOrArray);
}

const singleOrArray = function (alwaysArray) {
  let last, path, id;
  const schema = {};
  const callback = this.jsonp || '';
  if (this.controller && this.controller.model() && this.controller.model().defaults && this.controller.model().defaults.path) {
    path = this.controller.model().defaults.path.substr(0, this.controller.model().defaults.path.length - 1);
    //id = this.controller.model().defaults.findBy || '_id';
  }
  return es.through(function (doc) {
    if (doc.constructor.name === 'model')
      doc = parse(JSON.stringify(doc));
    doc = doc instanceof Array ? doc : doc ? [doc] : undefined;
    if (!last && doc)
      this.emit('data', callback + '([');
    for (var d of doc) {
      d = JSON.stringify(d || null);
      if (path)
        d = _.extract(d, id, path);
      if (last)
        this.emit('data', ',');
      last = d || last || ' ';
      this.emit('data', d.replace(datetime, 'new Date($1)'));
      Object.assign(schema, JSON.parse(d.replace(/,?"[^"]+":(\[\]|\{\})/g, '')));
    }
  }, function () {
    this.emit('data', ']');
    this.emit('data', ',' + JSON.stringify(schema).replace(datetime, 'new Date($1)')); //.replace(/":"[^"]+"/g, '":""');
    this.emit('data', ')');
    this.emit('end');
  });
};