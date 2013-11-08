(function() {
  var EventEmitter, Simon, async, fs, net, spawn, _,
    __hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;

  spawn = require('child_process').spawn;

  net = require('net');

  fs = require('fs');

  async = require('async');

  _ = require('lodash');

  Simon = (function() {
    Simon.prototype.child = null;

    Simon.prototype.source = "";

    Simon.prototype.filename = "";

    Simon.nextPort = 1000;

    _.extend(Simon.prototype, EventEmitter.prototype);

    function Simon(options) {
      var defaults;
      if (options == null) {
        options = {};
      }
      EventEmitter.call(this);
      defaults = {
        tmpDir: "/tmp",
        casperjs: {
          verbose: true,
          logLevel: 'error',
          binary: 'casperjs',
          port: 5000,
          autoPort: false
        }
      };
      this.cfg = _.defaults(_.clone(options, true), defaults);
      this.cfg.casperjs = _.defaults(this.cfg.casperjs, defaults.casperjs);
      this.source = "var casper = require('casper').create();";
    }

    Simon.prototype.addSource = function(code) {
      return this.source += ";" + code;
    };

    Simon.prototype.casperOn = function(eventName, cb) {
      this.on(eventName, cb);
      return this.addSource("casper.on('" + eventName + "', function(){ \n  this.echo(\"simon:event:" + eventName + ":\" + JSON.stringify([].slice.call(arguments)));\n});");
    };

    Simon.prototype.start = function(url, fn) {
      if (fn == null) {
        fn = function() {};
      }
      return this.addSource("casper.start('" + url + "', " + fn + ")");
    };

    Simon.prototype.then = function(fn) {
      return this.addSource("casper.then(" + fn + ")");
    };

    Simon.prototype.exportVars = function(vars) {
      var name, value, _results;
      _results = [];
      for (name in vars) {
        if (!__hasProp.call(vars, name)) continue;
        value = vars[name];
        if (typeof value === "string") {
          value = "'" + value + "'";
        }
        _results.push(this.addSource("var " + name + " = " + value));
      }
      return _results;
    };

    Simon.prototype.run = function(cb) {
      var parallel,
        _this = this;
      this.addSource("casper.run(" + cb + ")");
      this.filename = this.cfg.tmpDir + "/" + _.uniqueId(Date.now()) + ".js";
      parallel = {
        port: function(callback) {
          if (!_this.cfg.casperjs.autoPort) {
            return callback(null, _this.cfg.casperjs.port);
          }
          return _this._getFreePort(callback);
        },
        file: function(callback) {
          return fs.writeFile(_this.filename, _this.source, callback);
        }
      };
      return async.parallel(parallel, function(err, results) {
        var args, child, name, value, _ref;
        if (err) {
          return console.log("Simon::error", err);
        }
        args = [];
        _this.cfg.casperjs.port = results.port;
        _ref = _this.cfg.casperjs;
        for (name in _ref) {
          if (!__hasProp.call(_ref, name)) continue;
          value = _ref[name];
          if (name !== "binary") {
            args.push("--" + name + "=" + value);
          }
        }
        args.push(_this.filename);
        child = spawn(_this.cfg.casperjs.binary, args);
        child.stdout.setEncoding("utf8");
        child.stdout.on('data', function(data) {
          if (data.indexOf("simon") > -1) {
            return _this._parseStdoutMessage(data);
          }
        });
        return child.on("exit", function(code, signal) {
          var e;
          fs.unlink(_this.filename);
          if (code) {
            e = new Error("Simon: Child terminated with non-zero exit code " + code);
            e.details = {
              code: code,
              signal: signal
            };
            return _this.emit("error", e);
          }
        });
      });
    };

    Simon.prototype.destroy = function() {
      return this.child.kill();
    };

    Simon.prototype._parseStdoutMessage = function(msg) {
      var args, data, matches, message, module, str, type;
      matches = msg.match(/([^:]+):([^:]+):([^:]+):(.*)/);
      if (matches) {
        str = matches[0], module = matches[1], type = matches[2], message = matches[3], data = matches[4];
        switch (type) {
          case "event":
            args = JSON.parse(data);
            args.unshift(message);
            return this.emit.apply(this, args);
        }
      }
    };

    Simon.prototype._getFreePort = function(cb) {
      var server;
      if (++Simon.nextPort >= 65500) {
        Simon.nextPort = 1000;
      }
      server = net.createServer();
      server.once("error", function(err) {
        if (err.code === "EADDRINUSE") {
          return this._getFreePort(cb);
        }
      });
      server.once("listening", function() {
        server.close();
        return cb(null, port);
      });
      return server.listen(port);
    };

    return Simon;

  })();

  module.exports = Simon;

}).call(this);
