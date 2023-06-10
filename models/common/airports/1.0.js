const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: { type: Number, alias: 'id' },
  ident: String,
  type: { type: String, enum: ['medium_airport', 'closed', 'large_airport', 'heliport', 'seaplane_base', 'balloonport'] },
  name: String,
  latitude_deg: Number,
  longitude_deg: Number,
  elevation_ft: Number,
  continent: { type: String, enum: ['AS', 'OC', 'EU', 'AF', 'AN', 'SA', 'NA'] },
  iso_country: String,
  iso_region: String,
  municipality: String,
  scheduled_service: { type: Boolean, set: v => v == 'yes' },
  gps_code: String,
  iata_code: String,
  local_code: String
}, { id: false, autoIndex: true, versionKey: false, toObject: { transform: true } });

schema.virtual('country', { ref: 'common_country_1.0.0', localField: 'iso_country', foreignField: 'alpha2', justOne: true });

schema.index({ iso_country: 1 });

module.exports = mongoose.attach(process.env.DATADB, 'common_airport_1.0.0', schema, 'airports');

schema.options.toObject.transform = (doc, ret, opt) => {
  for (let key in ret)
    if (!ret[key]) delete ret[key];
  return ret;
};

//setTimeout(() => require('request').get('http://ourairports.com/data/airports.csv').pipe(parser).pipe(transformer), 3000);