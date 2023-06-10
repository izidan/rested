require('dotenv').config();
const request = require('request');
const child = require('./monitor');
const net = require('net');
const os = require('os');
process.chdir(__dirname);
require('./logger')();

const healthCheck = (port, cb) =>
  request.get({ url: `http://localhost:${port}/-server/stats`, json: true, jar: false }, (err, res, data) => {
    if (err)
      return cb(`Health check failed: error received, ${err}`.error('monitor', err) && false);
    if (Array.isArray(data))
      data = data[0];
    if (data.port !== port)
      return cb(`Health check failed: invalid process id, ${data}`.error('monitor', data) && false);
    var mem = Math.round(data.memory.rss / 1048576); // turn it into MB
    if (mem > 2048)
      return cb(`Health check failed: memory usage (${mem}MB) above 2GB limit`.error('monitor', data) && false);
    if (mem > 1024)
      `Health check warning: memory usage (${mem}MB) above 1GB limit`.warn('monitor', data);
    return cb(true);
  })

const children = [];
const numWorkers = os.cpus().length;
const startPort = parseInt(process.env.PORT || 80);

for (let i = 1; i <= numWorkers; i++)
  children.push(child.spawn("./server.js", startPort + i, healthCheck, { PORT: startPort + i, HOST: 'localhost' }));

process.on('SIGHUP', () => {
  "SIGHUP received, respawning all nodes".info('monitor');
  return child.bounce(children);
});

process.on('SIGINT', () => {
  "SIGINT received, killing all nodes".info('monitor');
  return child.terminate(children, process.exit);
});

process.on('SIGTERM', () => {
  "SIGTERM received, killing all nodes".info('monitor');
  return child.terminate(children, process.exit);
});

process.on('exit', code => {
  `EXIT(${code}) received, killing all nodes`.info('monitor');
  return child.terminate(children, process.exit);
});