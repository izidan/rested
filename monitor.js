const child_process = require('child_process');
const es = require('event-stream');
const async = require('async');

const healthCheckInterval = 30 * 1000;
const bounceInterval = 60 * 1000;
const bounceWait = bounceInterval + 30 * 1000;

const delayTimeout = (ms, func) => setTimeout(func, ms)

const MonitoredChild = class MonitoredChild {
  constructor(script, port, healthCheck, environmentVariables) {
    this.script = script;
    this.port = port;
    this.healthCheck = healthCheck;
    this.environmentVariables = environmentVariables;
    this.healthCheckTimeout = null;
    this.expectedExit = false;
    this.bounceTimeout = null;
    this.currentChild = null;
  }

  bounce() {
    if (this.currentChild == null)
      return this.respawn();
    `bouncing node on port ${this.port}, pid:${this.currentChild.pid}`.log('childProcess');
    clearTimeout(this.healthCheckTimeout);
    this.expectedExit = true;
    this.currentChild.kill();
    return this.bounceTimeout = delayTimeout(bounceInterval, () => {
      "node did not exit in time, forcefully killing it".error('childProcess');
      return this.currentChild.kill("SIGKILL");
    });
  }

  terminate() {
    `terminating node on port ${this.port}, pid:${this.currentChild.pid}`.log('childProcess');
    clearTimeout(this.healthCheckTimeout);
    this.expectedExit = true;
    this.currentChild.kill();
    this.bounceTimeout = delayTimeout(bounceInterval, () => {
      "node did not exit in time, forcefully killing it".error('childProcess');
      this.currentChild.kill("SIGKILL");
    });
  }

  check() {
    this.healthCheckTimeout = delayTimeout(healthCheckInterval, () => {
      let start = new Date();
      this.healthCheck(this.port, healthy => {
        if (healthy) {
          `node on port ${this.port} is healthy, ping time ${new Date() - start}ms`.verbose('childProcess');
          this.check();
        } else {
          `node on ${this.port} did not respond in time, killing it harshly`.error('childProcess');
          this.currentChild.kill("SIGKILL");
        }
      });
    });
  }

  respawn() {
    let env = process.env;
    Object.assign(env, this.environmentVariables);
    this.currentChild = child_process.spawn(process.execPath, [this.script], { env: env });
    `starting node on port ${this.port}, pid:${this.currentChild.pid}`.info('childProcess', { port: this.port, pid: this.currentChild.pid });
    this.currentChild.stdout.pipe(es.split()).pipe(es.through(
      data => `node log [${this.port}]: ${data}`.info('childOutput', { message: data, port: this.port, pid: this.currentChild.pid })));
    this.currentChild.stderr.pipe(es.split()).pipe(es.through(
      data => `node log [${this.port}]: ${data}`.error('childOutput', { message: data, port: this.port, pid: this.currentChild.pid })));
    this.currentChild.on('exit', code => {
      clearTimeout(this.healthCheckTimeout);
      clearTimeout(this.bounceTimeout);
      if (this.expectedExit)
        `exiting node on port ${this.port}, pid:${this.currentChild.pid}, respawning`.info('childProcess', this.expectedExit = false);
      else if (this.currentChild != null)
        `node on port ${this.port}, pid:${this.currentChild.pid}, exited with code ${code}, respawning`.error('childProcess');
      else
        `node exited with code ${code}, terminating`.error('childProcess');
      if (this.currentChild != null)
        return this.respawn();
    });
    return this.check();
  }
};

exports.bounce = (monitoredChildren, callback) => {
  monitoredChildren.forEach(monitoredChild => monitoredChild.bounce());
  if (callback != null)
    delayTimeout(bounceWait, callback);
};

exports.terminate = (monitoredChildren, callback) => {
  monitoredChildren.forEach(monitoredChild => monitoredChild.terminate());
  if (callback != null)
    callback();
};

exports.spawn = (script, port, healthCheck, environmentVariables) => {
  var ret = new MonitoredChild(script, port, healthCheck, environmentVariables);
  ret.respawn();
  return ret;
};