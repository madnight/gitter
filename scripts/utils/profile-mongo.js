#!/usr/bin/env node
/*jslint node: true */
"use strict";

var env = require('gitter-web-env');
var winston = env.logger;
var mongoose = require('mongoose');
require('gitter-web-persistence');

var opts = require('yargs')
  .option('max', {
    alias: 'm',
    required: false,
    'default': 50,
    description: 'Max querytime'
  })
  .help('help')
  .alias('help', 'h')
  .argv;

var max = opts.max;

var connection = mongoose.connection;
connection.on('open', function () {
  var nativeDb = mongoose.connection.db;

  var profileCollection = nativeDb.collection("system.profile");
  profileCollection.findOne({}, { sort: [[ "ts",  -1 ]] }, function(err, latest) {
    var ts = err || !latest ? 0 : latest.ts;

    winston.info("MongoDB profiling enabled");

    setInterval(function() {
      profileCollection.find({ ts: { $gt: ts } }, { sort: { ts: 1 }}).toArray(function(err, items) {
        if(err) return;

        if(items.length === 0)  return;
        items.forEach(function(item) {
          if(item.ts < ts) return;

          if(item.millis > max) {
            winston.warn("Mongo operation exceeded max", item);
          }

          if(item.ts > ts) ts = item.ts;
        });

      });
    }, 2000);
  });


});
