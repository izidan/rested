const es = require('event-stream');
const _ = require('underscore');
const jxon = require('jxon');

const parse = JSON._parse || JSON.parse;

const datergx = RegExp('T00:00:00.000Z', 'g'); // ensure dates represented as dates
const numbergx = RegExp('(?!>)\\d+(\\.\\d+)?e-\\d+(?=<)', 'g'); // fix representation of numbers with exponent
const nullattrgx = RegExp('(\"[_|@][^\"]+\"):null', 'g');

module.exports = baucis => {
  baucis.setFormatter('text/xml', singleOrArray);
  baucis.setFormatter('application/xml', singleOrArray);
}

const singleOrArray = function (alwaysArray) {
  let last, path, arrayOf, id;
  var singular = this.controller ? this.controller.model().singular() : undefined;
  singular = singular ? singular[0].toUpperCase() + singular.substr(1) : 'object';
  if (this.controller && this.controller.model() && this.controller.model().defaults && this.controller.model().defaults.path) {
    path = this.controller.model().defaults.path.substr(0, this.controller.model().defaults.path.length - 1);
    //id = this.controller.model().defaults.findBy || '_id';
    singular = path.split('.').pop();
  }
  return es.through(function (doc) {
    if (doc.constructor.name === 'model')
      doc = parse(JSON.stringify(doc));
    if (path)
      doc = _.extract(doc, id, path);
    if (!last) {
      this.emit('data', '<?xml version="1.0" encoding="utf-8"?>');
      if (alwaysArray) {
        singular = (doc != null ? doc['='] : void 0) || singular;
        arrayOf = singular.replace(/\w+:(\w)/, '$1');
        arrayOf = arrayOf[0].toUpperCase() + arrayOf.substr(1);
        last = `<ArrayOf${arrayOf}>`;
      } else last = '';
    } else last = '';
    doc['@id'] = doc._id;
    delete doc._id;
    last += xml(singular, doc);
    this.emit('data', last);
  }, function () {
    if (alwaysArray)
      this.emit('data', `</ArrayOf${arrayOf}>`);
    return this.emit('end');
  });
};

module.exports.xml = xml = (root, doc, opt) =>
  (doc instanceof Array ? doc : doc != null ? [doc] : [])
    .map(d => jxon.jsToXml(d, null, root)).join('')
    // ensure dates without timestamp represented as date string
    .replace(datergx, '')
    // remove empty attributes
    .replace(nullattrgx, '$1:""')
    // ensure double numbers with exponent part are translated to full number
    .replace(numbergx, txt => `0.${new Array(txt.split('e-')[1] - 0).join('0')}${txt.split('e-')[0].replace('.', '')}`);

jxon.config({
  attrKey: '@',
  attrPrefix: '@',
  valueKey: '@',
  autoDate: false,
  trueIsEmpty: false,
  parseValues: false,
  lowerCaseTags: false,
  ignorePrefixedNodes: false,
  parserErrorHandler: undefined
});