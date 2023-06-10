const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: Number,
  port: Number,
  uptime: Number,
  memory: Object,
}, {
    id: false,
    versionKey: false,
  });

module.exports = mongoose.model('@server_stat_1.0.0', schema, false);

let find = (cond, opt, callback) => !callback ? { count: cb => cb(null, 1) } : callback(null, {
  close: cb => cb(null, null),
  next: function (cb) {
    // end stream after sending first object
    this.next = this.close;
    // send data on first next call
    cb(null, { port: parseInt(process.env.PORT), memory: process.memoryUsage(), uptime: process.uptime(), _id: process.pid });
  }
});

module.exports.collection.find = find;