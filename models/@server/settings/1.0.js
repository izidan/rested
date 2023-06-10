const mongoose = require('mongoose');
const os = require('os');

const schema = new mongoose.Schema({
  _id: false,
}, {
    id: false,
    _id: false,
    versionKey: false,
  });

module.exports = mongoose.model('@server_setting_1.0.0', schema, false);

let find = (cond, opt, callback) => !callback ? { count: cb => cb(null, 1) } : callback(null, {
  close: cb => cb(null, null),
  next: function (cb) {
    // end stream after sending first object
    this.next = this.close;
    // send data on first next call
    cb(null, [process.version, os.type(), os.platform(), os.arch(), os.release(), os.cpus(), os.networkInterfaces()]);
  }
});

module.exports.collection.find = find;