require('dotenv').config();
require('./utils');

const args = Object.assign({ d: __dirname, c: 'import', f: '\\.\\w+$' }, require('minimist')(process.argv.slice(2)));

const mongoose = require('mongoose');
const csv = require('csv-parser');
const debug = require('debug');
const jxon = require('jxon');
const path = require('path');
const fs = require('fs');

debug('args')(args);

// mongoose setup
mongoose.set('autoReconnect', true);
mongoose.set('useNewUrlParser', true);
mongoose.set('debug', process.env.DEBUG && process.env.DEBUG.match(/,?[^-]?mongoose/));

mongoose.connect(process.env.MONGODB).catch(err => err.code !== 11000 ? debug('db')(err) : void 0).then(() => debug('db')('Connected to database successfully'));

const schema = mongoose.Schema({ _id: Object }, { id: false, strict: false, versionKey: false });//, collation: { locale: 'en', strength: 1 } });
const model = mongoose.model(args.collection || args.c, schema, args.collection || args.c);

jxon.config({
    attrKey: '@',
    attrPrefix: '@',
    valueKey: '@',
    autoDate: true,
    trueIsEmpty: false,
    parseValues: false,
    lowerCaseTags: false,
    ignorePrefixedNodes: false,
    parserErrorHandler: undefined
});

fs.readdir(args.dir || args.d, (err, files) => {
    Promise.all(files.filter(f => f.match(new RegExp(args.filter || args.f))).map(file => {
        let ext = file.split('.').pop();
        return (transform[ext] || (j => Promise.resolve(debug(ext)('transformer doesn\'t exist for %s', j))))
            (path.join(args.dir || args.d, file).toLowerCase());
    })).then(() => setTimeout(process.exit, 1000));
});

String.prototype.toTitleCase = function () {
    return this.trim().replace(/^[A-Z|0-9]+?(?=[A-Z]?[a-z])/g, t => t.toLowerCase())
        .replace(/(?![a-z])([A-Z]+)$/g, t => t[0].toUpperCase() + t.substr(1).toLowerCase());
}

const store = async bulks => bulks.length === 0 ? Promise.resolve(0) : model.bulkWrite(bulks, { ordered: false })
    .then(out => debug('store')('%s matched %o changed %o', model.collection.name, out.result.nMatched, out.result.nInserted + out.result.nUpserted + out.result.nModified + out.result.nRemoved))
    .catch(err => debug('error')(err))

const transform = {
    xml: file => {
        let _id = file.split(/[^\w]/).reverse()[1];
        let xml = fs.readFileSync(file, 'utf-8');
        let json = jxon.stringToJs(xml);
        json = (args.root || args.r || '').split('.').reduce((obj, key) => obj[key] || obj, json);
        while (Object.keys(json).length === 1) json = json[Object.keys(json)[0]];
        json = Array.isArray(json) ? json : [json];
        let transformer = transform[model.collection.name] || ((j) => j);
        let bulks = json.map(transformer).filter(obj => (typeof (obj) !== 'string')).map(obj => {
            let id = (Object.keys(obj).filter(k => k.match(/@id|Id|ID/)) || ['_id'])[0];
            return { updateOne: { filter: { _id: _id + '_' + obj[id] }, update: obj, upsert: true } };
        });
        debug('xml')('%s %o', file, bulks.length);
        return store(bulks);
    },
    csv: file => new Promise((resolve, reject) => {
        let count = 0;
        let bulks = [];
        let _id = file.split(/[^\w]/).reverse()[1];
        let parser = csv({
            mapHeaders: ({ header }) => header.toTitleCase(),
            mapValues: ({ header, value }) => value.match(/^\s*$/) ? undefined :
                header.match(/@id|Id|ID/) ? value : !isNaN(value) ? Number(value) :
                    value.match(/^\d{2}\/\d{2}\/\d{4}$/) ? new Date(value.split('/').reverse().join('-')) : value
        });
        fs.createReadStream(file).pipe(parser)
            //.on('data', row => { throw new Error(console.log(row)) })
            .on('data', row => {
                row._id = _id + '_' + (row.tradeId || row.secId || row.assetId) + '_' + row.seqNo;
                bulks.push({ updateOne: { filter: { _id: row._id }, update: row, upsert: true } });
                if (++count % 10000 > 0) return;
                store(bulks);
                bulks = [];
            })
            .on('end', () => {
                debug('csv')('%s %o', file, count);
                store(bulks).then(resolve);
            })
            .on('error', reject);
    }),
    trades: json => {
        json = JSON.stringify(json)
            // remove empty strings properties
            .replace(/"[^"]+":(""|{"@TYPE":"[^"]+"}),?/gm, '')
            // numerics should be mapped as numbers
            .replace(/{"@TYPE":"Numeric","@":"([^"]+)"}/gm, '$1')
            // object refs should be mapped as strings
            .replace(/{"@TYPE":"ObjRef","@":"([^"]+)"}/gm, '"=$1"')
            // remove empty objects properties
            .replace(/"[^"]+":{[\s|,]*},?/gm, '')
            // remove leftover commas and empty objects
            .replace(/,}/gm, '}').replace(/"[^"]+":{[\s|,]*},?/gm, '');
        for (var x = 0; x < 9 && json.match(/"@TYPE":"EntList"/); x++)
            // remove empty elements with only type no value
            json = json
                .replace(/"[^"]+":{"@TYPE":"[^"]+"(,"@SINGLE":"[N|Y]")?},?/gm, '')
                // remove leftover commas and empty objects
                .replace(/,}/gm, '}').replace(/"[^"]+":{[\s|,]*},?/gm, '')
                // change signle element list to an object
                .replace(/{"[A-Z|_]+":((?:{[^{}]+(?:[.*?][^{}]*)?},?)+),"@TYPE":"EntList","@SINGLE":"Y"}/gm, '$1')
                .replace(/{"[A-Z|_]+":({[^@]*?}),"@TYPE":"EntList","@SINGLE":"Y"}/gm, '$1')
                // change multiple elements list to an array
                .replace(/{"[A-Z|_]+":\[?((?:{[^{}]+(?:[.*?][^{}]*)?},?)+)\]?,"@TYPE":"EntList","@SINGLE":"N"}/gm, '[$1]')
                .replace(/{"[A-Z|_]+":\[?({[^@]*?})\]?,"@TYPE":"EntList","@SINGLE":"N"}/gm, '[$1]');
        if (json.match(/"@TYPE":/))
            debug('xml:trades')(json) || fs.writeFileSync('error.json', json);
        json = json.replace(/"([^"]*)Date":"(\d{4})(\d\d)(\d\d)"/gi, '"$1Date":"$2-$3-$4"')
            .replace(/"([^"]+)Date":"([\d|-]{8,11})","\1Time":"(\d\d:\d\d:\d\d)"/gm, '"$1Date":"$2","$1Time":"$2 $3"')
            .replace(/"(\d{4})(\d\d)(\d\d) (\d\d:\d\d:\d\d)"/gm, '"$1-$2-$3 $4"')
        // Y is true, N is false
        json = json.replace(/:"Y"/g, ':true').replace(/:"N"/g, ':false');
        // correct attribute casing and removing of _
        json = json.replace(/(?!"[^"_]+)_(?=[^"_]+":)/g, '')
            .replace(/(?!="[^"_]+)[A-Z]{2,}_[A-Z]{2,}(?=[A-Z][^"_]+":)/g, t => t.split('_').map(s => s[0] + s.substr(1).toLowerCase()).join(''))
            .replace(/(?!="[^"_]+)([A-Z]{2,}_)+(?=[A-Z][^"_]+":)/g, t => t.split('_').map(s => s ? s[0] + s.substr(1).toLowerCase() : '').join(''))
            .replace(/(?<=")[A-Z|0-9]+?(?=([A-Z]?[a-z][^"]*)?":)/g, t => t.toLowerCase())
            .replace(/"[^A-Z]+[A-Z]":/g, t => t.toLowerCase());
        if (json.match(/"[^"]*[^a-zA-Z0-9"][^"]*":/))
            debug('xml:trades')((json.match(/.{99}"[^"]*[^a-zA-Z0-9"][^"]*":.{99}/) || []).join('\n\n'));
        return JSON.parse(json);
    },
}

