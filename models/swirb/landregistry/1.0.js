const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    _id: Number,
}, {
        id: false,
        versionKey: false,
    });

module.exports = mongoose.attach(process.env.SWIRBDB, 'swirb_landRegistry_1.0.0', schema, 'landregistry');