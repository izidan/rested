// __Module Definition__
module.exports = function () {
  // Build the "Allow" response header
  this.request((request, response, next) => {
    let active = ['head', 'get', 'post', 'put', 'delete'].filter(method => this.methods(method) !== false);
    let allowed = active.map(verb => verb.toUpperCase());
    response.set('Allow', allowed.join());
    next();
  });
};
