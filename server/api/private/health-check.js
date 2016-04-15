"use strict";

var env        = require('gitter-web-env');
var nconf      = env.config;
var os         = require("os");
var appVersion = require('../../web/appVersion');

module.exports = function(req, res) {
  res.send("OK from " + os.hostname() + ":" + nconf.get('PORT') + ", running " + appVersion.getVersion());
};
