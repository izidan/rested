const through = require('through2');
const yaml = require('js-yaml');

module.exports = function () {
    this.setFormatter('text/yml', singleOrArray);
    this.setFormatter('text/yaml', singleOrArray);
    this.setFormatter('text/plain', singleOrArray);
    this.setFormatter('application/yml', singleOrArray);
    this.setFormatter('application/txt', singleOrArray);
    this.setFormatter('application/yaml', singleOrArray);
    this.setFormatter('application/text', singleOrArray);
};

const singleOrArray = () =>
    through.obj(function (doc, enc, callback) {
        if (doc.constructor.name === 'model')
            doc = JSON.parse(JSON.stringify(doc));
        doc = doc instanceof Array ? doc : doc ? [doc] : undefined;
        this.emit('data', yaml.safeDump(doc));
        callback();
    });
