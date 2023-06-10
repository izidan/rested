const es = require('event-stream');
const _ = require('underscore');

const clean = /(\s*{|\s*}|\[|\s*\]|\s\s"|",?|\s*,$)/gm

module.exports = baucis => {
  baucis.setFormatter('text/plain', singleOrArray);
  baucis.setFormatter('application/text', singleOrArray);
};

const singleOrArray = function (alwaysArray) {
  let path, id;
  let toString = this.controller && this.controller.model().schema.methods.toString;
  toString = toString && toString.toString().indexOf('function toString()') < 0;
  if (this.controller && this.controller.model() && this.controller.model().defaults && this.controller.model().defaults.path) {
    path = this.controller.model().defaults.path.substr(0, this.controller.model().defaults.path.length - 1);
    //id = this.controller.model().defaults.findBy || '_id';
  }
  return es.map((doc, nxt) => {
    if (path)
      doc = _.extract(doc, id, path);
    !doc ? nxt(null) : toString ? doc.toString((err, data) => nxt(err, data + '\n')) :
      nxt(null, JSON.stringify(doc, null, '  ').replace(clean, '').replace(/": "?/g, ': ') + '\n')
  });
};