#require("http").createServer().listen(9615)
EventEmitter = require('events').EventEmitter
spawn = require('child_process').spawn
net = require 'net'
fs = require 'fs'
async = require 'async'
_ = require 'lodash'

# Class is designed to work with Casperjs
#
class Simon
  child: null
  source: ""
  filename: ""
  @nextPort: 1000

  _.extend @prototype, EventEmitter.prototype

  constructor: (options={}) ->
    EventEmitter.call(@)
    # options by default
    defaults = 
      tmpDir: "/tmp"
      casperjs:
        verbose	: true
        logLevel: 'error'
        binary	: 'casperjs'
        port	: 5000
        autoPort: false

    @cfg = _.defaults _.clone(options, true), defaults
    @cfg.casperjs = _.defaults @cfg.casperjs, defaults.casperjs

    @source = "var casper = require('casper').create();"

  # Add more source code
  addSource: (code) ->
    @source += ";#{code}" 

  # Add listener to the casperjs instance
  casperOn: (eventName, cb) ->
    @on eventName, cb
    @addSource """casper.on('#{eventName}', function(){ 
      this.echo("simon:event:#{eventName}:" + JSON.stringify([].slice.call(arguments)));
    });"""

  # Configures and starts Casper, then open the provided url and optionally 
  # adds the step provided by the then argument:
  start: (url, fn=->) ->
    @addSource "casper.start('#{url}', #{fn})" 

  # This method is the standard way to add a new navigation step to the stack, 
  # by providing a simple function
  then: (fn) ->
    @addSource "casper.then(#{fn})"

  # Exports variables to the casperjs
  exportVars: (vars) ->
    for own name, value of vars
      value = "'#{value}'"if typeof value is "string"
      @addSource "var #{name} = #{value}"

  # Runs the whole suite of steps and optionally 
  # executes a callback when they’ve all been done
  run: (cb)->
    @addSource "casper.run(#{cb})"
    @filename = @cfg.tmpDir + "/" + _.uniqueId(Date.now()) + ".js"

    parallel =
      port: (callback) =>
        return callback(null, @cfg.casperjs.port) unless @cfg.casperjs.autoPort
        @_getFreePort callback
      
      file: (callback) =>
        fs.writeFile @filename, @source, callback

    async.parallel parallel, (err, results) =>
      #return console.log @source
      if err
        return console.log "Simon::error", err

      # generate parameters for casperjs
      args = []
      @cfg.casperjs.port = results.port
      for own name, value of @cfg.casperjs
        if name not in ["binary"]
          args.push("--#{name}=#{value}") 

      # add path to the js file in the end of ther arguments
      args.push @filename

      child = spawn @cfg.casperjs.binary, args
      child.stdout.setEncoding "utf8"
      child.stdout.on 'data', (data) =>
        # handle only our messages
         @_parseStdoutMessage(data) if data.indexOf("simon") > -1

      child.on "exit", (code, signal) =>
        fs.unlink @filename
        if code
          e = new Error("Simon: Child terminated with non-zero exit code " + code)
          e.details =
            code: code
            signal: signal

          @emit "error", e

  # Exits PhantomJS 
  destroy: ->
    @child.kill()

  # Parses message from console and execute specified by message method
  _parseStdoutMessage: (msg) ->
    matches = msg.match(/([^:]+):([^:]+):([^:]+):(.*)/)

    if matches 
      [str, module, type, message, data] = matches
      switch type
        when "event" 
          args = JSON.parse(data)
          args.unshift message
          @emit.apply @, args

  # Returns free port so casperjs can use it 
  _getFreePort: (cb) ->
    Simon.nextPort = 1000 if ++Simon.nextPort >= 65500

    server = net.createServer();
    server.once "error", (err) ->
      @_getFreePort(cb) if err.code is "EADDRINUSE"

    # port is currently in use
    server.once "listening", ->   
      # close the server if listening doesn't fail
      server.close()
      cb(null, port)

    server.listen port

module.exports = Simon