const errors = require('http-errors');

// __Module Definition__
module.exports = function () {
  // Set the conditions used for finding/updating/removing documents.
  this.request((request, response, next) => {
    let conditions = request.query.conditions || {};
    if (typeof conditions === 'string')
      try { conditions = JSON.parse(conditions); }
      catch (exception) { return next(errors.BadRequest(`The conditions query string value was not valid JSON: "${exception.message}"`)); }

    if (conditions.$explain && !this.explain())
      return next(errors.BadRequest('Using $explain is disabled for this resource'));

    if (request.params.id !== undefined)
      conditions[this.findBy()] = request.params.id;

    let query = Object.assign({}, request.query);
    query = this.model().translateAliases(query);

    // check if any of the query params matches any of the schema paths to add it to the conditions
    for (let key in query) {
      if (!this.model().schema.path(key)) continue;
      if (query[key][0] === '{')
        try { query[key] = JSON.parse(query[key]); }
        catch (exception) { return next(errors.BadRequest(`The ${key} query string value was not valid JSON: "${exception.message}"`)); }
      else if (query[key].indexOf(',') > 0)
        query[key] = { $in: query[key].split(',') };
      conditions[key] = query[key];
    }

    request.rested.conditions = this.model().translateAliases(conditions);
    next();
  });
};
