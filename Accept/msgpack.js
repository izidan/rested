const msgpack = require('msgpack-lite');
const through = require('through2');
const express = require('express');

express.static.mime.define({
    'application/msgpack+json': ['bin', 'msgpack']
});

module.exports = function () {
    this.setFormatter('application/binary', singleOrArray);
    this.setFormatter('application/msgpack', singleOrArray);
    this.setFormatter('application/binary+json', singleOrArray);
    this.setFormatter('application/octet-stream', singleOrArray);
    this.setFormatter('application/msgpack+json', singleOrArray);
};

const singleOrArray = function (alwaysArray) {
    let count = 0;
    let stream = msgpack.createEncodeStream();
    if (typeof this.send === "function")
        this.send(through.obj(function (doc, enc, callback) {
            if (doc && doc.constructor.name === 'model')
                doc = JSON.parse(JSON.stringify(doc));
            alwaysArray = alwaysArray || (doc instanceof Array);
            doc = doc instanceof Array ? doc : doc ? [doc] : undefined;
            if (alwaysArray && count === 0 && Array.isArray(doc)) {
                stream.encoder.reserve(5);
                stream.encoder.buffer[0] = 0xdd;
            }
            for (var d of doc) {
                count++;
                this.emit('data', d);
            }
            callback();
        }, function () {
            if (alwaysArray)
                msgpack.encode(count).forEach((v, i) => stream.encoder.buffer[4 - i] = v);
            this.emit('end');
        }));
    return stream;
};
//
