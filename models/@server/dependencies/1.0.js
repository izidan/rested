const child_process = require('child_process');
const mongoose = require('mongoose');
const os = require('os');

const schema = new mongoose.Schema({
  _id: false,
}, {
    id: false,
    _id: false,
    versionKey: false,
  });

module.exports = mongoose.model('@server_dependency_1.0.0', schema, false);

let find = (cond, opt, callback) => !callback ? { count: cb => cb(null, 1) } : callback(null, {
  close: cb => cb(null, null),
  next: function (cb) {
    // end stream after sending first object
    this.next = this.close;
    // send data on first next call
    child_process.exec('npm ls --production --json', (err, stdout, stderr) => cb(stderr || err,
      (JSON.parse(stdout.replace(/npm\s+WARN\s+.*?({|'?\w+\1:)|npm\s+ERR.*/gm, '$1')) || {}).dependencies));
  }
});

module.exports.collection.find = find;