const msgpack = require('msgpack-lite');
const es = require('event-stream');
const express = require('express');
const _ = require('underscore');

const parse = JSON._parse || JSON.parse;

const regex1 = RegExp('"[^"]+"\s*\:\s*', 'g'); // remove object properties
const regex2 = RegExp('{', 'g'); // change object start from { to [
const regex3 = RegExp('}', 'g'); // change object end from } to ]

express.static.mime.define({
  'application/x-msgpack+json': ['xbin', 'raw']
});

module.exports = baucis => {
  baucis.setFormatter('application/raw', singleOrArray);
  baucis.setFormatter('application/raw+json', singleOrArray);
  baucis.setFormatter('application/x-msgpack+json', singleOrArray);
};

const singleOrArray = function (alwaysArray) {
  let path, id;
  if (this.controller && this.controller.model() && this.controller.model().defaults && this.controller.model().defaults.path) {
    path = this.controller.model().defaults.path.substr(0, this.controller.model().defaults.path.length - 1);
    //id = this.controller.model().defaults.findBy || '_id';
  }
  if (typeof this.send === "function")
    this.send(es.map((doc, nxt) => nxt(null, parse(JSON.stringify(path ? _.extract(doc, id, path) : doc).replace(regex1, '').replace(regex2, '[').replace(regex3, ']')))));
  return msgpack.createEncodeStream();
};