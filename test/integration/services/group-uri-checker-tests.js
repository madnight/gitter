'use strict';

var StatusError = require('statuserror');
var testRequire = require('../test-require');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var assert = require("assert");
var groupUriChecker = testRequire('./services/group-uri-checker');


describe('group-uri-checker #slow', function() {
  var fixture = fixtureLoader.setup({
    user1: {
      githubToken: fixtureLoader.GITTER_INTEGRATION_USER_SCOPE_TOKEN
    },
    group1: {},
    troupe1: {}
  });

  it('should throw an error if you pass in an invalid group uri', function() {
    return groupUriChecker(fixture.user1, 'about')
      .then(function() {
        assert.ok(false, 'Error expected');
      })
      .catch(StatusError, function(err) {
        assert.strictEqual(err.status, 400);
      });
  });

  it('should resolve to true if a user with that username exists', function() {
    return groupUriChecker(fixture.user1, fixture.user1.username)
      .then(function(exists) {
        assert.strictEqual(exists, true);
      });
  });

  it('should resolve to true if a group with that uri exists', function() {
    return groupUriChecker(fixture.user1, fixture.group1.uri)
      .then(function(exists) {
        assert.strictEqual(exists, true);
      });
  });

  it('should resolve to true if a troupe with that uri exists', function() {
    return groupUriChecker(fixture.user1, fixture.troupe1.uri)
      .then(function(exists) {
        assert.strictEqual(exists, true);
      });
  });

  it('should resolve to true if a gh org with that login exists', function() {
    return groupUriChecker(fixture.user1, fixtureLoader.GITTER_INTEGRATION_ORG)
      .then(function(exists) {
        assert.strictEqual(exists, true);
      });
  });

  it('should resolve to true if a gh user with that login exists', function() {
    return groupUriChecker(fixture.user1, fixtureLoader.GITTER_INTEGRATION_USERNAME)
      .then(function(exists) {
        assert.strictEqual(exists, true);
      });
  });

  it('should resolve to false if the uri is not taken in any way', function() {
    return groupUriChecker(fixture.user1, '_this-should-not-exist')
      .then(function(exists) {
        assert.strictEqual(exists, false);
      });
  });

});
