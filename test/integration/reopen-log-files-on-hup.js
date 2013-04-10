/*jslint node: true */
/*global describe:true, it: true */
"use strict";

// This test spawns itself, when it does this is what it runs
if(process.argv[2] == 'log') {
  var w = require("../../server/utils/winston");
  setTimeout(function() {
    process.exit();
  }, 1000);

  setInterval(function() {
    w.info("Hello");
  }, 50);

} else {
  var assert = require("better-assert");

  var fs = require('fs');

  describe('winston', function() {
    it('should reobtain log file handles post HUP signal', function(done) {
       var fs = require('fs'),
          spawn = require('child_process').spawn;

          var logFile = '/tmp/reopen-log-files-on-hup-child.log';

          if(fs.existsSync(logFile)) fs.unlinkSync(logFile);

          var child = spawn('node', [ __filename, 'log', '--logging:logToFile=true', '--LOG_FILE=' + logFile], { stdio: 'inherit' });

          setTimeout(function() {
            assert(fs.existsSync(logFile));
            fs.unlinkSync(logFile);
            assert(!fs.existsSync(logFile));

            child.kill('SIGHUP');

            setTimeout(function() {
              child.kill();

              assert(fs.existsSync(logFile));
              fs.unlinkSync(logFile);

              done();

            }, 500);

          }, 500);
    });
  });
}