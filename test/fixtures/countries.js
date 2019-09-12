require('mongodb');
const mongoose = require('mongoose');
const express = require('express');
const csv = require('csv-parser');
const baucis = require('../..');
const fs = require('fs');

let app;
let server;
const Schema = mongoose.Schema;

mongoose.set('useCreateIndex', true);
mongoose.set('useNewUrlParser', true);
mongoose.set('useUnifiedTopology', true);
mongoose.set('debug', (process.env.DEBUG || '').match(/mongoose/));

const toTitleCase = (str) => str.trim()
    .replace(/([-\s_\(\)\[\]\\\/:])\w?/g, t => t.substr(1).toUpperCase())
    .replace(/(?![a-z])([A-Z]+)$/g, t => t[0].toUpperCase() + t.substr(1).toLowerCase())
    .replace(/^[A-Z|0-9]+?(?=[A-Z]?[a-z|0-9])/g, t => t.toLowerCase())

const parser = csv({
    mapHeaders: ({ header }) => toTitleCase(header),
    mapValues: ({ header, value }) => value.match(/^\s*$/) ? undefined :
        header.match(/@id|Id|ID/) ? value : !isNaN(value) ? Number(value) :
            value.match(/^\d{2}\/\d{2}\/\d{4}$/) ? new Date(value.split('/').reverse().join('-')) : value
});

const Countries = new Schema({
    _id: { type: String, alias: 'isO31661Alpha3' },
    name: { type: String, alias: 'cldrDisplayName' },
    names: {
        official: {
            ar: { type: String, alias: 'officialNameAr' },
            cn: { type: String, alias: 'officialNameCn' },
            en: { type: String, alias: 'officialNameEn' },
            es: { type: String, alias: 'officialNameEs' },
            fr: { type: String, alias: 'officialNameFr' },
            ru: { type: String, alias: 'officialNameRu' },
        },
        formal: {
            ar: { type: String, alias: 'untermArabicFormal' },
            cn: { type: String, alias: 'untermChineseFormal' },
            en: { type: String, alias: 'untermEnglishFormal' },
            fr: { type: String, alias: 'untermFrenchFormal' },
            ru: { type: String, alias: 'untermRussianFormal' },
            es: { type: String, alias: 'untermSpanishFormal' },
        },
        short: {
            ar: { type: String, alias: 'untermArabicShort' },
            cn: { type: String, alias: 'untermChineseShort' },
            en: { type: String, alias: 'untermEnglishShort' },
            fr: { type: String, alias: 'untermFrenchShort' },
            ru: { type: String, alias: 'untermRussianShort' },
            es: { type: String, alias: 'untermSpanishShort' },
        }
    },
    capital: String,
    continent: String,
    iso: {
        alpha2: { alias: 'isO31661Alpha2', type: String },
        alpha3: { alias: 'isO31661Alpha3', type: String },
        numeric: { alias: 'isO31661Numeric', type: Number }
    },
    currency: { type: [String], alias: 'isO4217CurrencyAlphabeticCode', set: v => v ? v.toString().split(',') : v },
    languages: { type: [String], set: v => v ? v.toString().split(',') : v },
    independent: { type: Boolean, alias: 'isIndependent', set: v => v === 'Yes' },
    region: {
        code: { type: Number, alias: 'regionCode' },
        name: { type: String, alias: 'regionName' },
        subCode: { type: Number, alias: 'subRegionCode' },
        subName: { type: String, alias: 'subRegionName' },
        intermediateCode: { type: Number, alias: 'intermediateRegionCode' },
        intermediateName: { type: String, alias: 'intermediateRegionName' },
    }
    /*
    isO4217CurrencyAlphabeticCode: undefined,
    isO4217CurrencyCountryName: undefined,
    isO4217CurrencyMinorUnit: undefined,
    isO4217CurrencyName: undefined,
    isO4217CurrencyNumericCode: undefined,
    m49: 680, 
    ds: undefined,
    developedDevelopingCountries: 'Developed',
    dial: undefined,
    edgar: undefined,
    fifa: undefined,
    fips: undefined,
    gaul: undefined,
    geonameId: undefined,
    globalCode: 'True',
    globalName: 'World',
    ioc: undefined,
    itu: undefined,
    landLockedDevelopingCountriesLldc: undefined,
    leastDevelopedCountriesLdc: undefined,
    marc: undefined,    
    smallIslandDevelopingStatesSids: undefined,
    tld: undefined,
    wmo: undefined,
    */
}, { versionKey: false });

const Country = mongoose.model('country', Countries);

module.exports = {
    app: () => app,
    server: () => server,
    deinit: done => Promise.all([server.close(), mongoose.disconnect()]).then(done),
    init: async done => {
        await mongoose.connect(global.__MONGO_URI__);
        //await mongoose.connect('mongodb://localhost/test');

        baucis.rest(Country);
        Country.select('-names');

        app = express();
        app.use('/api', baucis());

        fs.createReadStream('test/data/country-codes.csv').pipe(parser)
            .on('data', async row => row.isO31661Alpha3 ? await Country.replaceOne({ _id: row.isO31661Alpha3 }, row, { upsert: true }) : null)
            .on('end', err => err ? done(err) : server = app.listen(done));
    }
};
