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

module.exports = mongoose.attach(process.env.ELAGIDB, 'elagi_radiologist_1.0.0', schema, 'radiologists');

module.exports.defaults = {
  aggregate: function () {
    return [
      this.location && Array.isArray(this.location.$in) ? { $geoNear: { near: { type: "Point", coordinates: this.location.$in }, distanceField: 'distance', spherical: delete this.location } } : undefined,
      {
        $project: {
          logo: 1, site: 1, phone: 1, rating: 1, distance: 1, name: '$en.name', address: '$en.address', keywords: '$en.keywords', description: '$en.description',
          location: { $ifNull: ['$location', '$en.geocode.geocode.geometry.location'] }
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