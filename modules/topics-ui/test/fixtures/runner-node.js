#!/usr/bin/env node

"use strict";

var Mocha = require('mocha');
var glob = require('glob');
var path = require('path');
var babelRegister = require('babel-register');
var babelConfig = require('../../dev/babel-config');

babelRegister(babelConfig);
require('jsdom-global')();


var opts = require('yargs')
  .option('grep', {
    alias: 'g',
    description: 'only run tests matching <pattern>'
  })
  .option('invert', {
    alias: 'i',
    type: 'boolean',
    description: 'inverts --grep matches',
    default: false
  })
  .option('full-trace', {
    type: 'boolean',
    description: 'Full stack trace'
  })
  .option('bail', {
    type: 'boolean',
    description: 'Whether to bail on first failure',
    default: true
  })
  .help('help')
  .alias('help', 'h')
  .argv;

var mocha = new Mocha({
  useColors: true,
  grep: opts.grep,
  invert: opts.invert,
  fullTrace: opts.fullTrace,
  bail: opts.bail
});


glob.sync(path.resolve(__dirname, '../specs') + '/**/*.{js,jsx}').forEach(function(filePath){
  if(/browser/.test(filePath)) { return; }
  mocha.addFile(filePath);
});

// Run the tests.
var runner = mocha.run(function(failures){
  process.on('exit', function () {
    process.exit(failures);  // exit with non-zero status if there were failures
  });
});

runner.on('end', function(){
  process.exit();
});
