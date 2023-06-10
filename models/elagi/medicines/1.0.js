const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  name: String,
  type: String
}, {
  id: false,
  versionKey: false
});

module.exports = mongoose.attach(process.env.ELAGIDB, 'elagi_medicine_1.0.0', schema, 'medicines');

module.exports.defaults = {
  aggregate: function() {
    return [
      { $addFields: { 'en._id': '$_id' } },
      { $replaceRoot: { newRoot: '$en' } },
      { $project: { name: 1, category: 1, producer: 1 } },
      { $match: this }
    ]
  }
};