const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  name: String,
  code: String,
  alpha2: String,
  capital: String,
  continent: String,
  currency: { type: String, ref: 'common_currency_1.0.0' }
}, {
  id: false,
  versionKey: false
});

schema.virtual('holidays', { ref: 'common_holiday_1.0.0', localField: 'alpha2', foreignField: 'country' });
schema.virtual('airports', { ref: 'common_airport_1.0.0', localField: 'alpha2', foreignField: 'iso_country' });

module.exports = mongoose.attach(process.env.DATADB, 'common_country_1.0.0-fr', schema, 'countries');

module.exports.defaults = {
  select: '-ar -es -ru -fr -en -cn',
  aggregate: [
    { $addFields: { name: '$fr.official' } }
  ]
};