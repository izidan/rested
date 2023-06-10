const msgpack = require('msgpack-lite');
const es = require('event-stream');
const express = require('express');
const _ = require('underscore');

const parse = JSON._parse || JSON.parse;

express.static.mime.define({
  'application/msgpack+json': ['bin', 'msgpack']
});


module.exports = baucis => {
  baucis.setFormatter('application/binary', singleOrArray);
  baucis.setFormatter('application/binary+json', singleOrArray);
  baucis.setFormatter('application/octet-stream', singleOrArray);
  baucis.setFormatter('application/msgpack+json', singleOrArray);
};

const singleOrArray = function (alwaysArray) {
  let path, id;
  if (this.controller && this.controller.model() && this.controller.model().defaults && this.controller.model().defaults.path) {
    path = this.controller.model().defaults.path.substr(0, this.controller.model().defaults.path.length - 1);
    //id = this.controller.model().defaults.findBy || '_id';
  }
  if (typeof this.send === "function")
    this.send(es.through(function (doc) {
      var doc = parse(JSON.stringify(doc));
      doc = doc instanceof Array ? doc : doc ? [doc] : undefined;
      for (var d of doc)
        if (path)
          d = _.extract(d, id, path);
      this.emit('data', d);
    }));
  return msgpack.createEncodeStream();
};