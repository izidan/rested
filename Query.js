const mquery = require('mquery');
const utils = require('mongoose/lib/utils');
const { Query } = require('mongoose');

Query.prototype.count = function (filter, callback) {
    if (typeof filter === 'function') {
        callback = filter;
        filter = undefined;
    }
    filter = utils.toObject(filter);
    if (mquery.canMerge(filter))
        this.merge(filter);
    return this._count(callback);
}

Query.prototype._count = function (callback) {
    try { this.cast(this.model); }
    catch (err) { this.error(err); }
    if (this.error()) {
        return callback(this.error());
    }
    const conds = this._conditions;
    const options = this._optionsForExec();
    //this._collection.count(conds, options, callback);
    let cursor = this._collection.findCursor(conds, options);
    if (!callback) return cursor;
    cursor.count(utils.tick(callback));
};