const rewrite = require('express-urlrewrite');
const swagger = require('baucis-swagger');
const express = require('express');
const semver = require('semver');
const rested = require('rested');
const async = require('async');
const fs = require('fs');

const skip = new RegExp(`^\/?${fs.readdirSync("./public").map((f) => f.indexOf('.') < 0 ? f + '/' : f).join('|')}`);

module.exports = app => {
  // needed to bootstrap buacis
  rested();
  var produces = fs.readdirSync("./accepts").filter(f => f.match(/\.js/)).map(f => f.split('.js')[0]).reverse();
  produces.forEach(format => require(`./accepts/${format}.js`)(rested));
  produces = produces.map(format => express.static.mime.types[format]);
  produces = produces.sort((a, b) => a.split('/')[0] === b.split('/')[0] ? a.split('/')[1].length > b.split('/')[1].length : a.localeCompare(b));
  var modules = fs.readdirSync("./models").filter(d => !d.match(/\.(coffee|js)/));
  app.use(rewrite(new RegExp(`^/(${modules.filter(d => !d.match(/\.(coffee|js)/)).join('|')})/.*?\.html`), '/handsontable.html'));
  app.use(rewrite(new RegExp(`^/(${modules.filter(d => !d.match(/\.(coffee|js)/)).join('|')})$`), '/swagger.html'));
  async.concat(modules, (key, callbackm) => {
    let api = rested();
    let releases = [];
    let controllers = [];
    fs.readdir(`./models/${key}`, (err, dirs) => {
      async.concat(dirs.filter(d => !d.match(/\.(coffee|js)/)), (dir, callbackd) =>
        fs.readdir(`./models/${key}/${dir}`, (err, files) => {
          files = files.filter(f => f.match(/^\d+\.\d+(-[a-z]{2})?\.(coffee|js)$/g)).map(f => f.replace(/\.(coffee|js)$/, ''));
          /*.filter(file => {
            if ((config.release == null) || config.release.indexOf(`${key}_${dir}_${file}`) > -1)
              return;
            `file ${key}/${dir}/${file} is not marked for release`.info('general');
            return false;
          });*/
          // return in reverse order so newest versions come first
          files.sort((a, b) => semver.compare(b.replace(/(.\d+)/, '$1.0'), a.replace(/(.\d+)/, '$1.0'), { loose: true, includePrerelease: true }));
          async.forEachOf(files, (file, index, callbackc) => {
            try {
              const model = require(`./models/${key}/${dir}/${file}`);
              if (model && !!!model.modelName)
                return `file ${key}/${dir}/${file} doesn't export a model`.warn('general');
              if (model.modelName.split('_')[0] !== key)
                return `model ${model.modelName} has incorrect module name, expected ${key}.`.warn('general');
              var ver = model.modelName.split('_')[2];
              if (!ver.match(/\d+\.\d+\.\d+/g))
                return `model ${model.modelName} has incorrect version number, expected major.minor.revision`.warn('general');
              if (releases.indexOf(ver) < 0)
                releases.push(ver);
              var singular;
              if (model.defaults && !!model.defaults.path)
                singular = model.defaults.path.substr(0, model.defaults.path.length - 1).split('.').pop();
              if (singular == null || model.modelName.indexOf(singular) > 0)
                singular = model.modelName.split('_')[1];
              ver = '>=' + (file.match(/-/) != null ? file.replace('-', '.0-') : file + '.0' + ((files[index - 1] != null ? ' <' + semver.inc(file + '.0', 'minor') : void 0) || ''));
              (`${key}/${dir}/${file}`.padEnd(30, ' ') + singular.padEnd(20, ' ') + ver.padEnd(20, ' ') + model.modelName).log('general');
              /*if (model.singular == null) {
                // temp fix for bug https://github.com/wprl/baucis/issues/209
                baucis.Model.apply(model);
              }*/
              model.plural(dir);
              model.singular(singular);
              var controller = api.rest(model);
              controller.methods('put del post delete head options propfind', false);
              controller.versions(ver);
              controller.relations(false);
              controllers.push(controller);
              releases.push(model.modelName.split('_')[2]);
            } catch (error) {
              `${error.stack || error.type || error} './models/${key}/${dir}/${file}'`.error('general', error);
            }
            callbackc();
          }, callbackd);
        }), err => {
          releases = [...new Set(releases)];
          releases.sort((a, b) => semver.compare(b, a));
          callbackm(err, controllers.length <= 0 ? null : { api: api, module: key, releases: releases, controllers: controllers });
        });
    });
  }, (err, apis) => async.each(apis, (api, callbacka) => !api ? callbacka() :
    async.each(api.controllers, (controller, callbackc) => {
      controller.generateSwagger();
      controller.swagger.produces = produces;
      callbackc();
    }, err => {
      // publish all versions available
      api.releases.forEach(r => api.api.releases(r));
      // load the api file once the related models are loaded
      require(`./models/${api.module}/${api.module}`)(app, api.controllers);
      // publish the api-docs
      app.use(`/${api.module}`, api.api);
      callbacka();
    })));

  app.use((req, res, nxt) => {
    var format = null;
    if (!req.url.match(skip)) {
      // check if format is specified in the url
      if ((format = req.url.match(/\.([A-Za-z]+)(\?|$)/gi)) && express.static.mime.types[format[0].split('.')[1].split('?')[0]]) {
        req.url = req.url.replace(format[0], '?');
        req.headers.accept = express.static.mime.types[format[0].split('.')[1].split('?')[0]];
      }
      // check if locale is specified in the url
      if ((format = req.url.match(/\.([a-z]{2}(\?|$))/gi))) {
        req.url = req.url.replace(format[0], '?');
        req.headers['accept-language'] = format[0].split('.')[1].split('?')[0];
      }
      // check if version is specified in the url
      if ((format = req.url.match(/\.(\d+\.\d+(\?|$))/gi))) {
        req.url = req.url.replace(format[0], '?');
        req.headers['api-version'] = format[0].split('.').splice(1).join('.').split('?')[0];
      }
      if ((format = req.headers['accept-language'] || '') && format.match(/|(?!=[^|,])[a-z]{2}(?=(-[A-Z]{2})?[,|;|$]?)/) && !format.match(/^en/)) {
        req.headers['api-version'] = (req.headers['api-version'] || '*.*') + '.0-' + format.match(/(?!=[^|,])[a-z]{2}(?=(-[A-Z]{2})?[,|;|$]?)/)[0];
      }
      if (req.query.explain === 'true') {
        req.headers.accept = 'application/json';
      }
    }
    nxt();
  });
};