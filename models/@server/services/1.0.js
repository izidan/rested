const mongoose = require('mongoose');
const os = require('os');

const map = {};

const schema = new mongoose.Schema({
  _id: String,
  module: String,
  version: String,
  model: String,
  service: String,
  documentation: String,
  self: Boolean,
  references: { type: [String], ref: '@server_service_1.0.0' }
}, {
    id: false,
    versionKey: false,
  });

module.exports = mongoose.model('@server_service_1.0.0', schema, false);

let find = (cond, opt, callback) => !callback ? { count: cb => cb(null, 1) } : callback(null, {
  close: cb => cb(null, null),
  next: function (cb) {
    // end stream after sending first object
    this.next = this.close;
    if (Object.keys(map).length == 0) {
      mongoose.connections.forEach(c => {
        for (let m in c.models) {
          if (c.models[m].plural().indexOf('_') > 0) continue;
          map[m] = { _id: m };
          map[m].module = m.split('_')[0];
          map[m].version = m.split('_')[2];
          map[m].model = c.models[m].singular();
          map[m].service = c.models[m].plural();
          map[m].collection = c.models[m].collection.name;
          map[m].documentation = `/${m.split('_')[0]}/documentation/${c.models[m].plural()}.${m.split('_')[2].split('.')[0]}.${m.split('_')[2].split('.')[1]}`;
          map[m].references = c.models[m].schema.refs().split(',');
          if (map[m]._id === map[m].collection)
            delete map[m].collection;
          if (map[m].references.includes(m))
            map[m].self = true;
          if (map[m].references[0] === "")
            delete map[m].references;
        }
      });
      for (let m in map)
        if (map[m].references)
          map[m].references = map[m].references.map(r => JSON.parse(JSON.stringify(map[r])));
    }
    // send data on first next call
    cb(null, Object.values(map));
  }
});

module.exports.collection.find = find;