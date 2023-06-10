const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  name: String,
  logo: String,
  site: String,
  phone: String,
  rating: Number,
  address: String,
  keywords: [String],
  description: String,
  location: [Number],
  maps: String
}, {
  id: false,
  versionKey: false
});

//schema.plugin mongoosastic, { type: 'pharmacy', index: 'elagi_pharma', lean: true }
module.exports = mongoose.attach(process.env.ELAGIDB, 'elagi_pharmacy_1.0.0-ar', schema, 'pharmacies');

module.exports.defaults = {
  aggregate: function () {
    return [
      this.location && Array.isArray(this.location.$in) ? { $geoNear: { near: { type: "Point", coordinates: this.location.$in }, distanceField: 'distance', spherical: delete this.location } } : undefined,
      {
        $project: {
          logo: 1, site: 1, phone: 1, rating: 1, distance: 1, name: '$ar.name', address: '$ar.address', keywords: '$ar.keywords', description: '$ar.description',
          location: { $ifNull: ['$location', '$ar.geocode.geocode.geometry.location'] }
        }
      },
      {
        $addFields: {
          location: ['$location.lng', '$location.lat'],
          maps: { $concat: ['http://www.google.com/maps/?q=', { $substr: ['$location.lat', 0, -1] }, ',', { $substr: ['$location.lng', 0, -1] }] },
        }
      },
      { $match: this }
    ]
  }
};

//module.exports.resync?()