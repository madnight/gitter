/*jshint globalstrict:true, trailing:false */
/*global console:false, require: true, module: true */
"use strict";

var nconf = require('../utils/config');
var fs = require("fs");

function passthrough(url) {
  return url;
}


function cdnSingle(url) {
  return "//" + hosts[0] +cdnPrefix + "/" + url;
}

function cdnMulti(url) {
  var c  = this.cdnId === 0 || this.cdnId ? this.cdnId : -1;
  var d = (c + 1) % hostLength;
  this.cdnId = d;

  return "//" + hosts[d] +cdnPrefix + "/" + url;
}

var useCdn = nconf.get("cdn:use");

if(!useCdn) {
  module.exports = passthrough;
} else {
  var hosts = nconf.get("cdn:hosts");
  var hostLength = hosts.length;

  var cdnPrefix = nconf.get("cdn:prefix");
  if(cdnPrefix) {
    cdnPrefix = "/" + cdnPrefix;
  } else {
    var cdnPrefixFile = nconf.get("cdn:prefixFile");
    if(cdnPrefixFile) {
        cdnPrefix = "/" + ("" + fs.readFileSync(cdnPrefixFile)).trim();
    } else {
      cdnPrefix = "";
    }
  }

  if(hostLength > 1) {
    module.exports = cdnSingle;
  } else {
    module.exports = cdnMulti;
  }
}