const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  name: String,
  category: String,
  producer: String
}, {
  id: false,
  versionKey: false
});

module.exports = mongoose.attach(process.env.ELAGIDB, 'elagi_medicine_1.0.0-ar', schema, 'medicines');

module.exports.defaults = {
  aggregate: function() {
    return [
      { $addFields: { 'ar._id': '$_id' } },
      { $replaceRoot: { newRoot: '$ar' } },
      { $project: { name: 1, category: 1, producer: 1 } },
      { $match: this }
    ]
  }
};