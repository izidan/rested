const stringify = require('csv-stringify');
const through = require('through2');
const flatten = require('flat');

module.exports = function () {
    this.setFormatter('text/csv', singleOrArray);
    this.setFormatter('application/csv', singleOrArray);
    this.setFormatter('text/comma-separated-values', singleOrArray);
};

const singleOrArray = function () {
    let header = '\n';
    return through.obj(function (doc, enc, callback) {
        if (doc.constructor.name === 'model')
            doc = JSON.parse(JSON.stringify(doc));
        doc = doc instanceof Array ? doc : doc ? [doc] : undefined;
        doc = doc.map(d => d instanceof Object && Object.keys(d).length > 0 ? flatten(d) : { "": d });
        stringify(doc, { header: true, cast: { date: v => v.toISOString() } }, (err, output = '') => {
            if (output.indexOf(header) !== 0)
                header = output.match(/^.*?\n/)[0];
            else
                output = output.substr(header.length);
            this.emit('data', output)
            callback();
        });
    });
};
