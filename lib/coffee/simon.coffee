#require("http").createServer().listen(9615)
EventEmitter = require('events').EventEmitter
spawn = require('child_process').spawn
net = require 'net'
fs = require 'fs'
async = require 'async'
carrier = require 'carrier'
Stream = require 'stream'
_ = require 'lodash'

# Class is designed to work with Casperjs
#
class Simon
  child: null
  source: ""
  filename: ""
  @nextPort: 5555

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
        options: 
          exitOnError: false

    # TODO: Replace this with deep extend
    @cfg = _.defaults _.clone(options, true), defaults
    @cfg.casperjs = _.defaults @cfg.casperjs, defaults.casperjs
    @cfg.casperjs.options = _.defaults @cfg.casperjs.options, defaults.casperjs.options

    @source = "var casper = require('casper').create(JSON.parse('" +
      JSON.stringify(@cfg.casperjs.options).replace(/'/g, "\\'") + "'));"

  # Add more source code
  addSource: (code) ->
    @source += ";#{code}" 

  # Add listener to the casperjs instance
  addEventListener: (eventName, cb) ->
    @on eventName, cb
    @addSource """casper.on('#{eventName}', function(){ 
      this.echo("simon:event:#{eventName}:" + JSON.stringify([].slice.call(arguments)));
    });"""
  
  # Calls casper's method
  call: (methodName, args...) ->
    for value, i in args
      args[i] = "'#{value}'" if typeof value is "string"

    @addSource "casper.#{methodName}(#{args})"

  # Configures and starts Casper, then open the provided url and optionally 
  # adds the step provided by the then argument:
  start: ->
    @addSource "casper.start()" 

  # This method is the standard way to add a new navigation step to the stack, 
  # by providing a simple function
  then: (args...) ->
    vars = []
    vars = args.shift() if args.length > 1
    fn = args.shift()

    source = ""
    for own name, value of vars
      #value = "'#{value}'" if typeof value is "string"
      @addSource "var #{name} = JSON.parse('" + JSON.stringify(value).replace(/'/g, "\\'") + "');"

    source += "casper.then(#{fn})"
    @addSource "(function(){ #{source} })()"

  # Exports variables to the casperjs
  exportVars: (vars) ->
    for own name, value of vars
      value = "'#{value}'" if typeof value is "string"
      @addSource "var #{name} = JSON.parse('" + JSON.stringify(value).replace(/'/g, "\\'") + "');"

  # Runs the whole suite of steps and optionally 
  # executes a callback when they’ve all been done
  run: (cb) =>
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

      @child = spawn @cfg.casperjs.binary, args

      stdout = @child.stdout;
      stdout.setEncoding('utf8');
      @child.stdout = new Stream()
      carrier.carry(stdout).on 'line', (data) =>
        # handle only our messages
        @_parseStdoutMessage(data) if data.indexOf("simon") > -1

      @child.on "exit", (code, signal) =>
        fs.unlink @filename
        if code
          console.log("Simon: Child terminated with non-zero exit code " + code)
          @emit "error",
            code: code
            signal: signal

  # Exits PhantomJS 
  destroy: =>
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
    server.once "error", (err) =>
      @_getFreePort(cb) if err.code is "EADDRINUSE"

    # port is currently in use
    server.once "listening", ->   
      # close the server if listening doesn't fail
      server.close()
      cb(null, Simon.nextPort)

    server.listen Simon.nextPort

module.exports = Simon