const es = require('event-stream');
const yaml = require('js-yaml');
const _ = require('underscore');

module.exports = baucis => {
  baucis.setFormatter('text/yml', singleOrArray);
  baucis.setFormatter('text/yaml', singleOrArray);
  baucis.setFormatter('application/yml', singleOrArray);
  baucis.setFormatter('application/yaml', singleOrArray);
};

const singleOrArray = function (alwaysArray) {
  let path, id;
  if (this.controller && this.controller.model() && this.controller.model().defaults && this.controller.model().defaults.path) {
    path = this.controller.model().defaults.path.substr(0, this.controller.model().defaults.path.length - 1);
    //id = this.controller.model().defaults.findBy || '_id';
  }
  return es.map((doc, nxt) =>
    nxt(null, yaml.safeDump([path ? _.extract(doc, id, path) : doc]) + '\n'));
};