const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: false,
  name: String,
  type: { type: String, enum: ["public", "observance", "optional", "bank", "school"] },
  date: Date,
  start: Date,
  end: Date,
  subdivision: String,
  'province.code': String,
  'province.name': String
}, {
  id: false,
  _id: false,
  versionKey: false
});

schema.virtual('country', { ref: 'common_country_1.0.0', localField: 'country', foreignField: 'alpha2', justOne: true });

module.exports = mongoose.attach(process.env.DATADB, 'common_holiday_1.0.0', schema, 'holidays');

module.exports.defaults = {
  select: '-_id'
};