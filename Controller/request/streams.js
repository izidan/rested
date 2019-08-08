// __Dependencies__
const es = require('event-stream');
const domain = require('domain');

// __Module Definition__
module.exports = function (options, protect) {
  // __Protected Module Members__
  // A utility method for ordering through streams.
  protect.pipeline = handler => {
    const streams = [];
    const d = domain.create();
    d.on('error', handler);
    return transmute => {
      // If it's a stream, add it to the reserve pipeline.
      if (transmute && (transmute.writable || transmute.readable)) {
        streams.push(transmute);
        d.add(transmute);
        return transmute;
      }
      // If it's a function, create a map stream with it.
      if (transmute) {
        transmute = es.map(transmute);
        streams.push(transmute);
        d.add(transmute);
        return transmute;
      }
      // If called without arguments, return a pipeline linking all streams.
      if (streams.length > 0)
        return d.run(() => es.pipeline.apply(es, streams));
      // But, if no streams were added, just pass back a through stream.
      return d.run(es.through);
    };
  };
  // __Middleware__
  // Create the pipeline interface the user interacts with.
  this.request((request, response, next) => {
    request.baucis.incoming = protect.pipeline(next);
    request.baucis.outgoing = protect.pipeline(next);
    next();
  });
};
