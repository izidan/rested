const through = require('through2');

module.exports = function () {
    this.setFormatter('application/js', singleOrArray);
    this.setFormatter('application/jsonp', singleOrArray);
    this.setFormatter('application/javascript', singleOrArray);
}

const singleOrArray = function (alwaysArray) {
    let last;
    let schema = {};
    return through.obj(function (doc, enc, callback) {
        if (doc && doc.constructor.name === 'model')
            doc = JSON.parse(JSON.stringify(doc));
        alwaysArray = alwaysArray || (doc instanceof Array);
        doc = doc instanceof Array ? doc : doc !== undefined ? [doc] : undefined;
        if (alwaysArray && last === undefined && Array.isArray(doc))
            this.emit('data', 'jsonp([');
        for (var d of doc) {
            if (last !== undefined)
                this.emit('data', ',');
            last = d;
            d = JSON.stringify(d).replace(datetime, 'new Date($1)');
            this.emit('data', d);
            d = JSON.parse(d.replace(/,?"[^"]+":(\[\]|\{\})/g, ''));
            Object.assign(schema, d instanceof Object && Object.keys(d).length > 0 ? d : { [typeof d]: d });
        }
        callback();
    }, function () {
        if (alwaysArray)
            this.emit('data', ']');
        this.emit('data', ',' + JSON.stringify(schema).replace(datetime, 'new Date($1)'));
        //.replace(/":"[^"]+"/g, '":""');
        this.emit('data', ')');
        this.emit('end');
    });
};

const datetime = /("\d{4}-\d{2}-\d{2}[T|\s]\d{2}:\d{2}:\d{2}.*?")/g;
