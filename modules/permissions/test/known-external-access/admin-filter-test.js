'use strict';

var assert = require('assert');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');

describe('admin-filter', function() {

  describe('integration tests #slow', function() {
    fixtureLoader.disableMongoTableScans();

    describe('non group security types', function() {
      var URI = fixtureLoader.generateUri();
      var URI2 = fixtureLoader.generateUri();
      var adminFilter = require('../../lib/known-external-access/admin-filter');
      var recorder = require('../../lib/known-external-access/recorder');

      var fixture = fixtureLoader.setup({
        user1: {},
        user2: {},
        user3: {},
        group1: {
          securityDescriptor: {
            type: 'GH_ORG',
            members: 'PUBLIC',
            admins: 'GH_ORG_MEMBER',
            public: true,
            linkPath: URI,
            externalId: 'external3',
            extraAdmins: ['user1']
          }
        },
        group2: {
          securityDescriptor: {
            type: null,
            members: 'PUBLIC',
            admins: 'MANUAL',
            public: true,
            extraAdmins: ['user2']
          }
        },
        group3: {
          securityDescriptor: {
            type: 'GH_REPO',
            members: 'PUBLIC',
            admins: 'GH_REPO_PUSH',
            public: true,
            linkPath: URI2,
            externalId: null
          }
        },
        troupe1: {
          securityDescriptor: {
            type: 'GROUP',
            members: 'PUBLIC',
            admins: 'GROUP_ADMIN',
            public: true,
            linkPath: null,
            internalId: 'group1',
            externalId: null,
            extraMembers: [],
            extraAdmins: ['user2']
          }
        },

      });

      it('should return extra admin results', function() {
        return adminFilter(fixture.group1, [fixture.user1.id, fixture.user2._id])
          .then(function(filtered) {
            assert.deepEqual(filtered.map(String), [fixture.user1.id]);
          })
      });

      it('should return known positive values', function() {
        var userId1 = fixture.user1._id;
        var userId2 = fixture.user2._id;
        var userId3 = fixture.user3._id;

        return recorder.testOnly.handle(userId2, 'GH_ORG', 'GH_ORG_MEMBER', URI, 'external3', true)
          .delay(100) // Give mongo time to write to secondary...
          .then(function() {
            return adminFilter(fixture.group1, [userId1, userId2, userId3]);
          })
          .then(function(filtered) {
            assert.deepEqual(filtered.map(String), [userId1, userId2].map(String));
          });
      });

      it('should not return known negative values', function() {
        var userId1 = fixture.user1._id;
        var userId2 = fixture.user2._id;
        var userId3 = fixture.user3._id;

        // Positive first
        return recorder.testOnly.handle(userId2, 'GH_ORG', 'GH_ORG_MEMBER', URI, 'external3', true)
          .then(function() {
            // Negative
            return recorder.testOnly.handle(userId2, 'GH_ORG', 'GH_ORG_MEMBER', URI, 'external3', false);
          })
          .delay(100) // Give mongo time to write to secondary...
          .then(function() {
            return adminFilter(fixture.group1, [userId1, userId2, userId3]);
          })
          .then(function(filtered) {
            assert.deepEqual(filtered.map(String), [userId1].map(String));
          });
      });

      it('should work with non-backed security descriptors', function() {
        var userId1 = fixture.user1._id;
        var userId2 = fixture.user2._id;
        var userId3 = fixture.user3._id;

        return adminFilter(fixture.group2, [userId1, userId2, userId3])
          .then(function(filtered) {
            assert.deepEqual(filtered.map(String), [userId2].map(String));
          })
      });

      it('should work with GH_REPO security descriptors', function() {
        var userId1 = fixture.user1._id;
        var userId2 = fixture.user2._id;
        var userId3 = fixture.user3._id;

        // This also tests objecss with no extraAdmins....

        return recorder.testOnly.handle(userId2, 'GH_REPO', 'GH_REPO_PUSH', URI2, 'external_xx', true)
          .delay(100) // Mongodb slave wait
          .then(function() {
            return adminFilter(fixture.group3, [userId1, userId2, userId3]);
          })
          .then(function(filtered) {
            assert.deepEqual(filtered.map(String), [userId2].map(String));
          })
      });
    });

    describe('group security type', function() {
      var URI = fixtureLoader.generateUri();
      var adminFilter = require('../../lib/known-external-access/admin-filter');
      var recorder = require('../../lib/known-external-access/recorder');

      var fixture = fixtureLoader.setup({
        user1: {},
        user2: {},
        user3: {},
        user4: {},
        group1: {
          securityDescriptor: {
            type: 'GH_ORG',
            members: 'PUBLIC',
            admins: 'GH_ORG_MEMBER',
            public: true,
            linkPath: URI,
            extraAdmins: ['user1']
          }
        },
        troupe1: {
          securityDescriptor: {
            type: 'GROUP',
            members: 'PUBLIC',
            admins: 'GROUP_ADMIN',
            public: true,
            linkPath: null,
            internalId: 'group1',
            externalId: null,
            extraMembers: [],
            extraAdmins: ['user2']
          }
        },

      });

      it('should work with GROUP security type on extraAdmins', function() {
        var userId1 = fixture.user1._id;
        var userId2 = fixture.user2._id;
        var userId3 = fixture.user3._id;

        // userId1 is an extraAdmin in the group
        // userId2 is an extraAdmin in the room
        // userId3 is neither
        return adminFilter(fixture.troupe1, [userId1, userId2, userId3])
          .then(function(filtered) {
            var filteredString = filtered.map(String);
            filteredString.sort();

            assert.deepEqual(filteredString, [userId1, userId2].map(String));
          });
      });

      it('should return known positive values', function() {
        var userId1 = fixture.user1._id;
        var userId2 = fixture.user2._id;
        var userId4 = fixture.user4._id;

        return recorder.testOnly.handle(userId4, 'GH_ORG', 'GH_ORG_MEMBER', URI, null, true)
          .delay(100) // Mongodb slave wait
          .then(function() {
            return adminFilter(fixture.troupe1, [userId1, userId2, userId4]);
          })
          .then(function(filtered) {
            var filteredString = filtered.map(String);
            filteredString.sort();

            assert.deepEqual(filteredString, [userId1, userId2, userId4].map(String));
          });
      });

    });
  });

});
