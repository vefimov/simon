require("http").createServer().listen(9615)
EventEmitter = require('events').EventEmitter
spawn = require('child_process').spawn
carrier = require 'carrier' 
Stream = require('stream')
_ = require 'lodash'

# Class is designed to work with Casperjs
#
class Simon
  child: null

  constructor: (options={}) ->
    EventEmitter.call(@)
    # options by default
    defaults = 
      casperjs:
        verbose	: true
        logLevel: 'debug'
        binary	: 'casperjs'
        port	: 5000

    @cfg = _.defaults _.clone(options, true), defaults
    @cfg.casperjs = _.defaults @cfg.casperjs, defaults.casperjs

    
  run: ->
    args = []
    for own name, value of @cfg.casperjs
      if name not in ["binary"]
        args.push("--#{name}=#{value}") 

    args.push "/var/www/dev.org/public/simon/lib/test.js"

    child = spawn @cfg.casperjs.binary, args

    stdout = child.stdout
    stdout.setEncoding "utf8"
    child.stdout = new Stream()

    carrier.carry(stdout).on "line", (line) ->
      console.log "-------------------------#{line}"
      #@stdout.emit "data", line

    child.on "exit", (code, signal) ->
      console.log "exittttttttttttttt"

module.exports = Simon



i=0
setInterval ->
  simon = new Simon
    casperjs:
      port: 6000 + i++
      binary: "/home/valentinee/www/fastintop/library/casperjs/bin/casperjs"

  simon.run()
, 20

setInterval ->
  console.log Date.now()
, 20