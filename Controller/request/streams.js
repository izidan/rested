const es = require('event-stream');
const through = require('through2');
const domain = require('domain');

module.exports = function (options, protect) {
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
      return d.run(through.obj);
    };
  };
  // Create the pipeline interface the user interacts with.
  this.request((request, response, next) => {
    request.rested.incoming = protect.pipeline(next);
    request.rested.outgoing = protect.pipeline(next);
    next();
  });
};
