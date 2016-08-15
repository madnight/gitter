'use strict';

var testRequire = require('../test-require');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var assert = require('assert');
var groupCreationService = testRequire('./services/group-creation-service');

describe('group-creation-service', function() {
  describe('#slow', function() {

    var fixture = fixtureLoader.setup({
      user1: {}
    });

    it('should create a group without backing', function() {
      var uri = fixture.generateUri();

      return groupCreationService(fixture.user1, {
        uri: uri,
        name: uri,
        defaultRoom: {
        }
      })
      .then(function(result) {
        var group = result.group;
        var defaultRoom = result.defaultRoom;
        assert.deepEqual(result.invitesReport, []);

        assert.strictEqual(group.lcUri, uri);
        assert.strictEqual(group.uri, uri);
        assert.strictEqual(group.name, uri);
        assert.strictEqual(group.sd.members, 'PUBLIC');
        assert.strictEqual(group.sd.admins, 'MANUAL');
        assert.deepEqual(group.sd.extraAdmins.map(String), [fixture.user1.id]);
        assert.deepEqual(group.sd.extraMembers.map(String), []);

        assert.strictEqual(defaultRoom.uri, uri + '/Lobby');
        assert.strictEqual(defaultRoom.lcUri, uri + '/lobby');

        assert.strictEqual(defaultRoom.sd.type, null);
        assert.strictEqual(defaultRoom.sd.members, 'PUBLIC');
        assert.strictEqual(defaultRoom.sd.admins, 'MANUAL');

        // Coming soon to a cinema near you....
        // assert.strictEqual(String(defaultRoom.sd.internalId), group.id);
        // assert.deepEqual(defaultRoom.sd.extraAdmins.map(String), []);

        // But for the moment
        assert.equal(defaultRoom.sd.internalId, null);
        assert.deepEqual(defaultRoom.sd.extraAdmins.map(String), [fixture.user1.id]);

        assert.deepEqual(defaultRoom.sd.extraMembers.map(String), []);
      });
    });

  });
});