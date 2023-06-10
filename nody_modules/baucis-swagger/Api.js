// __Dependencies__
var deco = require.cache[require.resolve('rested')].require('deco');

// __Private Module Members__

// Figure out the basePath for Swagger API definition
function getBase(request, extra) {
  var parts = request.originalUrl.split('/');
  // Remove extra path parts.
  parts.splice(-extra, extra);
  return request.protocol + '://' + request.headers.host + parts.join('/');
};

// A method for generating a Swagger resource listing
function generateResourceListing(options) {
  var plurals = options.controllers.map(function (controller) {
    return { v: controller.versions().match(/[\d|\.]+/)[0], n: controller.model().plural() }
  });
  plurals.sort(function (a, b) {
    if (a.n < b.n) return -1;
    if (a.n > b.n) return 1;
    return 0;
  });
  var listing = {
    apiVersion: options.version.substr(0, options.version.lastIndexOf('.')),
    swaggerVersion: '1.1',
    basePath: options.basePath,
    apis: plurals.map(function (plural) {
      return { path: '/documentation/' + plural.n + '.' + plural.v.substr(0, plural.v.lastIndexOf('.')), description: 'Operations about ' + plural.n };
    })
  };

  return listing;
}

// __Module Definition__
var decorator = module.exports = function (options, protect) {
  var api = this;

  // Middleware for the documentation index.
  api.get('/documentation', function (request, response) {
    response.json(generateResourceListing({
      version: request.baucis.release,
      controllers: protect.controllers(request.baucis.release),
      basePath: getBase(request, 1)
    }));
  });

  // Find the correct controller to handle the request.
  api.get('/documentation/:path', function (request, response, next) {
    var fragment = '/' + request.params.path;
    var controllers = protect.controllers(request.baucis.release, fragment);
    // If not found, bail.
    if (controllers.length === 0) return next();

    controllers[0].generateSwagger();

    response.json(deco.merge(controllers[0].swagger, {
      apiVersion: request.baucis.release.substr(0, request.baucis.release.lastIndexOf('.')),
      swaggerVersion: '1.1',
      basePath: getBase(request, 2),
      resourcePath: fragment
    }));
  });

  return api;
};
