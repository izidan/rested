// __Dependencies__
const semver = require('semver');

// __Module Definition__
module.exports = function (options, protect) {
  const controllers = [];
  // __Public Instance Members__
  // Add a controller to the API.
  this.add = controller => {
    controllers.push(controller);
    return this;
  };
  // Return a copy of the controllers array, optionally filtered by release.
  protect.controllers = (release, fragment) => {
    let all = [].concat(controllers);
    if (!release) return all;
    let satisfies = all.filter(controller =>
      semver.satisfies(release, controller.versions(), { includePrerelease: true }) &&
      (release.indexOf('-') > 0) === (controller.versions().indexOf('-') > 0));
    if (!fragment)
      return satisfies;
    // Find the matching controller among controllers that match the requested release.
    return satisfies.filter(controller => fragment === controller.fragment());
  };
  // Find the correct controller to handle the request.
  this.use('/:path', (request, response, next) => {
    let fragment = '/' + request.params.path;
    let controllers = protect.controllers(request.baucis.release, fragment);
    // If not found, bail.
    if (controllers.length === 0) return next();
    request.baucis.controller = controllers[0];
    request.baucis.controller(request, response, next);
  });
};
