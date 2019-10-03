// __Dependencies__
const deco = require('deco');
const semver = require('semver');
const express = require('express');
const errors = require('http-errors');
const Controller = require('../Controller');

semver.prereleases = (releases, version) => releases.filter(release =>
  semver.satisfies(release, version, { includePrerelease: true }) &&
  semver.parse(release).comparePre(version.replace(/\*/g, '0')) === 0);

// __Module Definition__
const Api = module.exports = deco(function (options, protect) {
  this.use((request, response, next) => {
    if (request.rested) return next(errors.InternalServerError('Rested request property already created'));
    // maintain baucis compatability
    request.rested = request.baucis = {};
    response.removeHeader('x-powered-by');
    // Any caching proxies should be aware of API version.
    response.vary('Accept-Version');
    // TODO move this
    // Requested range is used to select highest possible release number.
    // Then later controllers are checked for matching the release number.
    let version = request.headers['accept-version'] || '*';
    // Check the requested API version is valid.
    if (!semver.validRange(version))
      return next(errors.BadRequest(`The requested API version range "${version}" was not a valid semver range`));
    // Use max satisfied release to replace version *.* pattern to reslove pre-releases/tags
    let releases = version.indexOf('-') > 0 ? semver.prereleases(this.releases(), version) : this.releases();
    request.rested.release = semver.maxSatisfying(releases, version, { includePrerelease: version.indexOf('-') > 0 });
    // Check for API version unsatisfied and give a 400 if no versions match.
    if (!request.rested.release)
      return next(errors.BadRequest(`The requested API version range "${version}" could not be satisfied`));
    response.set('Accept-Version', request.rested.release);
    next();
  });
  // __Public Members___
  protect.property('releases', ['0.0.1'], release => {
    if (!semver.valid(release))
      throw errors.InternalServerError(`Release version "${release}" is not a valid semver version`);
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
