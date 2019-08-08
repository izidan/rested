module.exports = ['config', 'controller', 'inheritence', 'subcontroller', 'vegetable', 'versioning']
    .reduce((o, f) => { o[f] = require(`./${f}`); return o }, {})