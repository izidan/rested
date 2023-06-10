const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    _id: String,
}, { id: false, strict: false, versionKey: false });

module.exports = mongoose.attach(process.env.FPMLDB, 'fpml_trade_1.0.0', schema, 'trades');

module.exports.defaults = {
    path: 'FpML.',
    findBy: 'header.messageId.@'
    //aggregate: [{ $replaceRoot: { newRoot: '$FpML' } }]
}