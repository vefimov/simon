(function() {
  var EventEmitter, Simon, Stream, carrier, i, spawn, _,
    __hasProp = {}.hasOwnProperty;

  require("http").createServer().listen(9615);

  EventEmitter = require('events').EventEmitter;

  spawn = require('child_process').spawn;

  carrier = require('carrier');

  Stream = require('stream');

  _ = require('lodash');

  Simon = (function() {
    Simon.prototype.child = null;

    function Simon(options) {
      var defaults;
      if (options == null) {
        options = {};
      }
      EventEmitter.call(this);
      defaults = {
        casperjs: {
          verbose: true,
          logLevel: 'debug',
          binary: 'casperjs',
          port: 5000
        }
      };
      this.cfg = _.defaults(_.clone(options, true), defaults);
      this.cfg.casperjs = _.defaults(this.cfg.casperjs, defaults.casperjs);
    }

    Simon.prototype.run = function() {
      var args, child, name, stdout, value, _ref;
      args = [];
      _ref = this.cfg.casperjs;
      for (name in _ref) {
        if (!__hasProp.call(_ref, name)) continue;
        value = _ref[name];
        if (name !== "binary") {
          args.push("--" + name + "=" + value);
        }
      }
      args.push("/var/www/dev.org/public/simon/lib/test.js");
      child = spawn(this.cfg.casperjs.binary, args);
      stdout = child.stdout;
      stdout.setEncoding("utf8");
      child.stdout = new Stream();
      carrier.carry(stdout).on("line", function(line) {
        return console.log("-------------------------" + line);
      });
      return child.on("exit", function(code, signal) {
        return console.log("exittttttttttttttt");
      });
    };

    return Simon;

  })();

  module.exports = Simon;

  i = 0;

  setInterval(function() {
    var simon;
    simon = new Simon({
      casperjs: {
        port: 6000 + i++,
        binary: "/home/valentinee/www/fastintop/library/casperjs/bin/casperjs"
      }
    });
    return simon.run();
  }, 20);

  setInterval(function() {
    return console.log(Date.now());
  }, 20);

}).call(this);
