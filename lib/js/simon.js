(function() {
  var EventEmitter, Simon, Stream, async, carrier, fs, net, spawn, _,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;

  spawn = require('child_process').spawn;

  net = require('net');

  fs = require('fs');

  async = require('async');

  carrier = require('carrier');

  Stream = require('stream');

  _ = require('lodash');

  Simon = (function() {
    Simon.prototype.child = null;

    Simon.prototype.source = "";

    Simon.prototype.filename = "";

    Simon.nextPort = 5555;

    _.extend(Simon.prototype, EventEmitter.prototype);

    function Simon(options) {
      var defaults;
      if (options == null) {
        options = {};
      }
      this.destroy = __bind(this.destroy, this);
      this.run = __bind(this.run, this);
      EventEmitter.call(this);
      defaults = {
        tmpDir: "/tmp",
        casperjs: {
          verbose: true,
          logLevel: 'error',
          binary: 'casperjs',
          port: 5000,
          autoPort: false,
          options: {
            exitOnError: false
          }
        }
      };
      this.cfg = _.defaults(_.clone(options, true), defaults);
      this.cfg.casperjs = _.defaults(this.cfg.casperjs, defaults.casperjs);
      this.cfg.casperjs.options = _.defaults(this.cfg.casperjs.options, defaults.casperjs.options);
      this.source = "var casper = require('casper').create(JSON.parse('" + JSON.stringify(this.cfg.casperjs.options).replace(/'/g, "\\'") + "'));";
    }

    Simon.prototype.addSource = function(code) {
      return this.source += ";" + code;
    };

    Simon.prototype.addEventListener = function(eventName, cb) {
      this.on(eventName, cb);
      return this.addSource("casper.on('" + eventName + "', function(){ \n  this.echo(\"simon:event:" + eventName + ":\" + JSON.stringify([].slice.call(arguments)));\n});");
    };

    Simon.prototype.call = function() {
      var args, i, methodName, value, _i, _len;
      methodName = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      for (i = _i = 0, _len = args.length; _i < _len; i = ++_i) {
        value = args[i];
        if (typeof value === "string") {
          args[i] = "'" + value + "'";
        }
      }
      return this.addSource("casper." + methodName + "(" + args + ")");
    };

    Simon.prototype.start = function() {
      return this.addSource("casper.start()");
    };

    Simon.prototype.then = function() {
      var args, fn, name, source, value, vars;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      vars = [];
      if (args.length > 1) {
        vars = args.shift();
      }
      fn = args.shift();
      source = "";
      for (name in vars) {
        if (!__hasProp.call(vars, name)) continue;
        value = vars[name];
        this.addSource(("var " + name + " = JSON.parse('") + JSON.stringify(value).replace(/'/g, "\\'") + "');");
      }
      source += "casper.then(" + fn + ")";
      return this.addSource("(function(){ " + source + " })()");
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
        _results.push(this.addSource(("var " + name + " = JSON.parse('") + JSON.stringify(value).replace(/'/g, "\\'") + "');"));
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
        var args, name, stdout, value, _ref;
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
        _this.child = spawn(_this.cfg.casperjs.binary, args);
        stdout = _this.child.stdout;
        stdout.setEncoding('utf8');
        _this.child.stdout = new Stream();
        carrier.carry(stdout).on('line', function(data) {
          if (data.indexOf("simon") > -1) {
            return _this._parseStdoutMessage(data);
          }
        });
        return _this.child.on("exit", function(code, signal) {
          fs.unlink(_this.filename);
          if (code) {
            console.log("Simon: Child terminated with non-zero exit code " + code);
            return _this.emit("error", {
              code: code,
              signal: signal
            });
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
      var server,
        _this = this;
      if (++Simon.nextPort >= 65500) {
        Simon.nextPort = 1000;
      }
      server = net.createServer();
      server.once("error", function(err) {
        if (err.code === "EADDRINUSE") {
          return _this._getFreePort(cb);
        }
      });
      server.once("listening", function() {
        server.close();
        return cb(null, Simon.nextPort);
      });
      return server.listen(Simon.nextPort);
    };

    return Simon;

  })();

  module.exports = Simon;

}).call(this);
