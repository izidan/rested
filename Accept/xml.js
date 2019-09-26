const through = require('through2');
const jxon = require('jxon');

module.exports = function () {
    this.setFormatter('text/xml', singleOrArray);
    this.setFormatter('application/xml', singleOrArray);
}

const singleOrArray = function (alwaysArray) {
    let last, arrayOf;
    let singular = this.controller ? this.controller.model().singular() : undefined;
    singular = singular ? singular[0].toUpperCase() + singular.substr(1) : 'object';
    return through.obj(function (doc, enc, callback) {
        if (doc && doc.constructor.name === 'model')
            doc = JSON.parse(JSON.stringify(doc));
        alwaysArray = alwaysArray || (doc instanceof Array);
        if (last === undefined) {
            this.emit('data', '<?xml version="1.0" encoding="utf-8"?>');
            singular = doc && doc['@xsi:type'] !== null && doc['@xsi:type'].split(':').pop().match(/^[a-z]/) ? doc['@xsi:type'] : singular;
            if (alwaysArray) {
                arrayOf = singular.replace(/\w+:(\w)/, '$1');
                arrayOf = arrayOf[0].toUpperCase() + arrayOf.substr(1);
                last = `<ArrayOf${arrayOf}>`;
            } else last = '';
        } else last = '';
        if (singular === doc['@xsi:type'])
            delete doc['@xsi:type'];
        if (!doc['@id'] && !!doc._id) {
            doc['@id'] = doc._id;
            delete doc._id;
        }
        last += xml(singular, doc);
        this.emit('data', last);
        callback();
    }, function () {
        if (alwaysArray)
            this.emit('data', `</ArrayOf${arrayOf}>`);
        this.emit('end');
    });
};

const datergx = RegExp('T00:00:00.000Z', 'g'); // ensure dates represented as dates
const numbergx = RegExp('(?!>)\\d+(\\.\\d+)?e-\\d+(?=<)', 'g'); // fix representation of numbers with exponent
const nullattrgx = RegExp('(\"[_|@][^\"]+\"):null', 'g');

const xml = (root, doc, opt) => (doc instanceof Array ? doc : doc !== null ? [doc] : [])
    .map(d => jxon.jsToXml(d, null, root)).join('')
    // ensure dates without timestamp represented as iso date string
    .replace(datergx, '')
    // remove empty attributes
    .replace(nullattrgx, '$1:""')
    // ensure double numbers with exponent part are translated to full number
    .replace(numbergx, txt => `0.${new Array(txt.split('e-')[1] - 0).join('0')}${txt.split('e-')[0].replace('.', '')}`);

jxon.config({
    attrKey: '@', attrPrefix: '@', valueKey: '@', autoDate: false, trueIsEmpty: false,
    parseValues: false, lowerCaseTags: false, ignorePrefixedNodes: false, parserErrorHandler: undefined
});
