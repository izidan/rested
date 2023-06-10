const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  name: String,
  type: String,
  info: String,
  price: Number,
  image: String,
  description: String,
  category: String,
  usage: String,
  producer: String,
  scientific: String
}, {
  id: false,
  versionKey: false
});

module.exports = mongoose.attach(process.env.ELAGIDB, 'elagi_medicine_1.1.0', schema, 'medicines');

module.exports.defaults = {
  aggregate: function() {
    return [
      { $addFields: { 'en._id': '$_id' } },
      { $replaceRoot: { newRoot: '$en' } },
      { $match: this }
    ]
  }
};