const mongoose = require('mongoose');
const express = require('express');
const baucis = require('../..');
const config = require('./config');

let app;
let server;
const Schema = mongoose.Schema;

mongoose.set('useCreateIndex', true);
mongoose.set('useNewUrlParser', true);
mongoose.set('debug', (process.env.DEBUG || '').match(/mongoose/));

const User = new Schema({ name: String, tasks: [{ type: Schema.ObjectId, ref: 'task' }] });
const Task = new Schema({ name: String, user: { type: Schema.Types.ObjectId, ref: 'User' } });

mongoose.model('user', User);
mongoose.model('task', Task);

module.exports = {
  app: () => app,
  server: () => server,
  deinit: done => Promise.all([server.close(), mongoose.disconnect()]).then(done),
  init: done => {
    mongoose.connect(config.mongo.url);

    let users = baucis.rest('user');
    let tasks = users.vivify('tasks');

    tasks.request((request, response, next) => {
      request.baucis.outgoing((context, callback) => {
        context.doc.name = 'Changed by Middleware';
        callback(null, context);
      });
      next();
    });

    tasks.query((request, response, next) => {
      request.baucis.query.where('user', request.params._id);
      next();
    });

    app = express();
    app.use('/api', baucis());

    server = app.listen(done);
  },
  create: done =>
    // clear all first
    mongoose.model('user').deleteMany({}, error =>
      error ? done(error) : mongoose.model('task').deleteMany({}, error =>
        error ? done(error) : mongoose.model('user')
          .create(['Alice', 'Bob'].map(name => ({ name: name })), (error, alice) =>
            error ? done(error) : mongoose.model('task')
              .create(['Mow the Lawn', 'Make the Bed', 'Darn the Socks'].map(name => ({ name: name })), (error, task) => {
                if (error) return done(error);
                task.user = alice._id;
                task.save(done)
              })
          )))
};
