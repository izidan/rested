const moment = require('moment-timezone');
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  name: String,
  order: String,
  enabled: Boolean
}, {
  id: false,
  versionKey: false,
  toJSON: { virtuals: true }
});

//schema.methods.toString = (callback)->
//	return callback() if !@?
//	@_doc.collection = mongoose.connection.collection @_doc.collection
//	return @_doc.collection.aggregate(@_doc.aggregate, (err, data)-> callback err, data?.map((d)->d._id).toString()) if @_doc.aggregate?
//	@_doc.collection.find(@_doc.query, { _id: 1 }).sort(@_doc.sort).skip(@_doc.skip or 0).limit(@_doc.limit or 99).toArray (err, data)-> callback err, data?.map((d)->d._id).toString()

module.exports = mongoose.attach(process.env.LSEDB, 'lse_list_1.0.0', schema, 'lists');

schema.options.toJSON.transform = (doc, ret, options) => {
  Object.keys(ret.query || {}).filter(k => ret.query[k].constructor.name === "RegExp").forEach(k => ret.query[k] = ret.query[k].toString());
  return ret;
};