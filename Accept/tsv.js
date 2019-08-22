const stringify = require('csv-stringify');
const through = require('through2');
const flatten = require('flat');

module.exports = function () {
    this.setFormatter('text/tsv', singleOrArray);
    this.setFormatter('application/tsv', singleOrArray);
    this.setFormatter('text/tab-separated-values', singleOrArray);
};

const singleOrArray = function () {
    let header = '\n';
    return through.obj(function (doc, enc, callback) {
        if (doc.constructor.name === 'model')
            doc = JSON.parse(JSON.stringify(doc));
        doc = doc instanceof Array ? doc : doc ? [doc] : undefined;
        doc = doc.map(d => d instanceof Object && Object.keys(d).length > 0 ? flatten(d) : { "": d });
        stringify(doc, { header: true, cast: { date: v => v.toISOString() }, delimiter: '\t' }, (err, output = '') => {
            if (output.indexOf(header) !== 0)
                header = output.match(/^.*?\n/)[0];
            else
                output = output.substr(header.length);
            // ensure dates without timestamp represented as iso date string
            this.emit('data', output.replace(datergx, ''))
            callback();
        });
    });
};

const datergx = RegExp('T00:00:00.000Z', 'g'); // ensure dates represented as dates
