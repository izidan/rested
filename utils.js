require('./public/js/json.date-extensions.js');
const minify = require('minify');
const _ = require('underscore');
const fs = require('fs');

JSON.useDateParser();

const y = '[0-9]{4}';
const m29 = '02';
const m30 = '0[4|6|9]|11';
const m31 = '0[1|3|5|7|8]|1[0|2]';
const d29 = '0[1-9]|[12][0-9]';
const d30 = '0[1-9]|[12][0-9]|30';
const d31 = '0[1-9]|[12][0-9]|3[01]';
const hh = '[0-1][0-9]|2[0-3]';
const mm = '[0-5][0-9]';
const ss = '[0-5][0-9]';
const ms = '\\.{0,1}[0-9]*';
const zz = 'Z|[+|-][0-9|:]*';

RegExp.TIME = `(?:${hh})(?:${mm})(?:${ss})(?:${ms})?(?:${zz})?`;
RegExp.DATE = `${y}(?:(?:${m29})(?:${d29})|(?:${m30})(?:${d30})|(?:${m31})(?:${d31}))`;
RegExp.ISO = {
  TIME: `(?:${hh}):(?:${mm}):(?:${ss})(?:${ms})?(?:${zz})?`,
  DATE: `${y}-(?:(?:${m29})-(?:${d29})|(?:${m30})-(?:${d30})|(?:${m31})-(?:${d31}))`,
  DATETIME: `${y}-(?:(?:${m29})-(?:${d29})|(?:${m30})-(?:${d30})|(?:${m31})-(?:${d31}))T(?:${hh}):(?:${mm}):(?:${ss})(?:${ms})?(?:${zz})?`
};

Date.prototype.lastBusiness = function () { return new Date(this - 86400000 * Math.max(((Math.ceil(this.getDay() / 1.9) + 4) % 6) - 2, 1)) };
Date.lastBusiness = () => new Date().lastBusiness();

String.prototype.charCodes = () => this.split('').map(c => c.charCodeAt(0)).join('') * 1

String.prototype.minify = (file, nxt) => !file || (!process.env.DEBUG && fs.existsSync(`./public/js/${file}.min.js`)) ? nxt(false) :
  minify(`./public/js/${file}.js`).catch(nxt).then((data) =>
    fs.writeFile(`./public/js/${file}.min.js`, data, nxt));

_.mixin({
  path(obj, path, map) {
    let val = null;
    if (path instanceof Array) { return path.forEach(p => val || (val = _.path(obj, p, map))) || val; }
    if (!((obj != null) && !!path)) { return obj; }
    let dot = path.indexOf('.');
    const key = dot < 1 ? path : path.substr(0, dot);
    if (!!key) { val = obj[key]; }
    if ((dot < 1) && (map != null) && (val != null)) { return map(val); }
    if (dot < 1) { return val; }
    return _.path(val, path.substr(++dot), map);
  },
  extract(obj, id, path) {
    if ((obj == null) || (path == null)) { return obj; }
    const _id = obj[id];
    obj = _.path(obj, path) || obj;
    if (!!_id) { obj._id = _id; }
    return obj;
  },
  unwind(o, get, set) {
    return _.map((get(o)), function (val) {
      const clone = JSON.parse(JSON.stringify(o));
      set(clone, val);
      return clone;
    });
  },
  unique(arr, key) {
    let i;
    const o = {};
    if (!!key) {
      for (i of Array.from(arr)) {
        let v = i[key];
        if (!Array.isArray(v)) { v = [v]; }
        for (let t of Array.from(v)) { o[t] = null; }
      }
    } else {
      for (i of Array.from(arr)) { o[i] = null; }
    }
    return Object.keys(o);
  }
});