const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  name: String,
  code: String,
  withdrew: String,
  countries: { type: Object, ref: 'common_country_1.0.0' }
}, {
  id: false,
  versionKey: false
});

module.exports = mongoose.attach(process.env.DATADB, 'common_currency_1.0.0', schema, 'currencies');