// __Dependencies__
const deco = require('deco');
const semver = require('semver');
const express = require('express');
const RestError = require('rest-error');
const Controller = require('../Controller');

semver.prereleases = (releases, version) => releases.filter(release =>
  semver.satisfies(release, version, { includePrerelease: true }) &&
  semver.parse(release).comparePre(version.replace(/\*/g, '0')) === 0);

// __Module Definition__
const Api = module.exports = deco(function (options, protect) {
  this.use((request, response, next) => {
    if (request.baucis) return next(RestError.Misconfigured('Baucis request property already created'));
    request.baucis = {};
    response.removeHeader('x-powered-by');
    // Any caching proxies should be aware of API version.
    response.vary('Accept-Version');
    // TODO move this
    // Requested range is used to select highest possible release number.
    // Then later controllers are checked for matching the release number.
    let version = request.headers['accept-version'] || '*';
    // Check the requested API version is valid.
    if (!semver.validRange(version))
      return next(RestError.BadRequest('The requested API version range "%s" was not a valid semver range', version));
    // Use max satisfied release to replace version *.* pattern to reslove pre-releases/tags
    let releases = version.indexOf('-') > 0 ? semver.prereleases(this.releases(), version) : this.releases();
    request.baucis.release = semver.maxSatisfying(releases, version, { includePrerelease: version.indexOf('-') > 0 });
    // Check for API version unsatisfied and give a 400 if no versions match.
    if (!request.baucis.release)
      return next(RestError.BadRequest('The requested API version range "%s" could not be satisfied', version));
    response.set('Accept-Version', request.baucis.release);
    next();
  });
  // __Public Members___
  protect.property('releases', ['0.0.1'], release => {
    if (!semver.valid(release))
      throw RestError.Misconfigured('Release version "%s" is not a valid semver version', release);
    return this.releases().concat(release);
  });

  this.rest = model => {
    let controller = Controller(model);
    this.add(controller);
    return controller;
  };
});

Api.factory(express.Router);
Api.decorators(__dirname, ['controllers']);
