/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var useragent = require('useragent');
var isPhone = require('../web/is-phone');
var _ = require('underscore');

// prior to 1.2.1, the ios app would incorrectly send its build number instead of the version nubmer
var mobileBuildVersionMapping = {
  '600': '1.2.0',
  '598': '1.1.1',
  '595': '1.1.0',
  '587': '1.0.0'
};

function isNativeApp(userAgentString) {
  return (userAgentString.indexOf('Gitter') >= 0 );
}

function getType(userAgentString) {
  return (isPhone(userAgentString) || userAgentString.indexOf('Mobile') >= 0) ? 'mobile' : 'desktop';
}

function getGitterAppMetadata(userAgentString) {
  // e.g GitterBeta/1.2.0
  var extension = userAgentString.substring(userAgentString.indexOf('Gitter')).split(' ')[0];

  var parts = extension.split('/');

  var family = parts[0];
  var version = parts[1];

  if(getType(userAgentString) === 'mobile') {
    version = mobileBuildVersionMapping[version] || version;
  }

  var versionParts = (version || '').split('.');

  return {
    family: family,
    major: versionParts[0] || '',
    minor: versionParts[1] || '',
    patch: versionParts[2] || ''
  };
}

function tagify(ua) {
  return {
    'agent:type': ua.type,
    'agent:family': ua.family,
    'agent:version': createVersionString(ua),
    'agent:device:family': ua.device.family,
    'agent:device:version': createVersionString(ua.device),
    'agent:os:family': ua.os.family,
    'agent:os:version': createVersionString(ua.os),
  };
}

function createVersionString(obj) {
  var version;
  if(obj.major) {
    version = '' + obj.major;
    if(obj.minor) {
      version = version + '.' + obj.minor;
      if(obj.patch) {
        version = version + '.' + obj.patch;
      }
    }
  }

  return version;
}

module.exports = function(userAgentString) {
  // no useragentstring? no tags for you.
  if(!userAgentString) return {};

  var userAgentObj = useragent.parse(userAgentString).toJSON();

  if(isNativeApp(userAgentString)) {
    var appMetadata = getGitterAppMetadata(userAgentString);
    userAgentObj = _.extend({}, userAgentObj, appMetadata);
  }
  userAgentObj.type = getType(userAgentString);

  return tagify(userAgentObj);
};