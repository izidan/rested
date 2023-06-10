const elasticsearch = require('elasticsearch');
const mongoosastic = require('mongoosastic');
const mongoose = require('mongoose');

esc = process.env.ELASTIC;
esc = !!esc ? new elasticsearch.Client({ host: esc, log: 'error' }) : null;

module.exports = (schema, pluginOpts) => {
  if (esc == null || !(schema instanceof mongoose.Schema) || !!!process.env.DEBUG) return;
  schema.plugin(mongoosastic, Object.assign(pluginOpts, { saveOnSynchronize: false, bulk: { batch: 1000, size: 1000, delay: 10000 }, esClient: esc }));
  schema.statics.resync = (timestamp, inQuery, inOpts, callback) => {
    var _this = this;
    callback = callback || (err => !!timestamp ? setTimeout((() => _this.resync(timestamp, inQuery, inOpts)), 1 * 60 * 1000) : null);
    setTimeout((() => {
      inOpts = { size: 1 };
      if (!!timestamp)
        inOpts.sort = {
          [timestamp]: "desc"
        };
      _this.search(null, inOpts, (err, last) => {
        var count = 0;
        if (err && !err.message.match(/index_not_found_exception/))
          return callback(err, err.message.error());
        var timestamped = last && last.hits && last.hits[0] && last.hits[0]._source ? last.hits[0]._source[timestamp] : null;
        `${_this.plural()} last index entry at ${timestamp} = ${timestamped}`.info();
        //_this.createMapping(err2 => err2 && !err2.message.match(/index_not_found_exception/) ? err2.message.error() : null
        //inOpts = Object.assign(inOpts || {}, { sort: { [timestamp]: 1 } });
        inQuery = Object.assign(inQuery || {}, {
          [timestamp]: { $gt: timestamped }
        });
        if (timestamped == null)
          delete inQuery[timestamp];
        var sync = _this.synchronize(inQuery, inOpts);
        sync.on('close', () => count > 0 ? !!timestamp ?
          `${count} ${_this.plural()} synchronized with ${timestamp} > ${timestamped}`.info() :
          `${count} ${_this.plural()} synchronized`.info() : null);
        sync.on('close', () => callback(err));
        sync.on('error', err3 => (err = err3) ? err3.message.error() : null);
        sync.on('data', (err, doc) => ++count);
      });
    }), 9999);
  };
};