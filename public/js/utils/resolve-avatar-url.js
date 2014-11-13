'use strict';
var GITHUB_URL = 'https://avatars.githubusercontent.com/';

module.exports = function (spec) {
  // setting the defaults
  var version = spec.version || 3;
  var username = spec.username || 'default';
  var size = spec.size || 60;

  return GITHUB_URL + username + '?' + 'v=' + version + '&s=' + size;
};