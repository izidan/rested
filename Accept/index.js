module.exports = function () {
    [
        'json',
        'xml',
        'csv',
        'tsv',
        'yaml',
        'jsonp',
        'msgpack'
    ].forEach(f => require(`./${f}`).apply(this));
};