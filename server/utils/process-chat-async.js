/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var Q = require('q');
var processChat = require('./process-chat');

module.exports = exports = function processChatAsync(text, callback) {
  return Q.resolve(processChat(text)).nodeify(callback);
};