'use strict';

var Promise = require('bluebird');
var assert = require('assert');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
var proxyquireNoCallThru = require("proxyquire").noCallThru();
var StatusError = require('statuserror');
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');

// stub out this check because otherwise we end up with a the tests all
// clashing with the user that's required to have access to create those
// groups..
var groupService = proxyquireNoCallThru('../lib/group-service', {
  './group-uri-checker': function() {
    return Promise.resolve({
      allowCreate: true
    });
  }
});

function compareSets(a, b) {
  // Sort before comparing, but don't mutate them when sorting. Not that that
  // matters at the time of writing, but just in case people start using this
  // elsewhere.
  // (Yes there are a million ways to do this.)
  assert.deepEqual(a.slice().sort(), b.slice().sort());
}

describe('group-service', function() {

  describe('integration tests #slow', function() {

    describe('createGroup', function() {
      var fixture = fixtureLoader.setup({
        deleteDocuments: {
          User: [{ username: fixtureLoader.GITTER_INTEGRATION_USERNAME }],
          Group: [
            { lcUri: fixtureLoader.GITTER_INTEGRATION_ORG.toLowerCase() },
            { lcUri: fixtureLoader.GITTER_INTEGRATION_REPO.toLowerCase() },
            { lcUri: fixtureLoader.GITTER_INTEGRATION_COMMUNITY.toLowerCase() },
            { lcUri: fixtureLoader.GITTER_INTEGRATION_USERNAME.toLowerCase() },
            { lcUri: 'bob' }
          ],
        },
        user1: {
          githubToken: fixtureLoader.GITTER_INTEGRATION_USER_SCOPE_TOKEN,
          username: fixtureLoader.GITTER_INTEGRATION_USERNAME
        }
      });

      it('should create a group for a GitHub org', function() {
        var groupUri = fixtureLoader.GITTER_INTEGRATION_ORG;
        var user = fixture.user1;
        return groupService.createGroup(user, {
            type: 'GH_ORG',
            name: 'Bob',
            uri: groupUri,
            linkPath: groupUri
          })
          .then(function(group) {
            assert.strictEqual(group.name, 'Bob');
            assert.strictEqual(group.uri, groupUri);
            assert.strictEqual(group.lcUri, groupUri.toLowerCase());
            return securityDescriptorService.getForGroupUser(group._id, null);
          })
          .then(function(securityDescriptor) {
            assert.deepEqual(securityDescriptor, {
              admins: 'GH_ORG_MEMBER',
              externalId: fixtureLoader.GITTER_INTEGRATION_ORG_ID,
              linkPath: fixtureLoader.GITTER_INTEGRATION_ORG,
              members: 'PUBLIC',
              public: true,
              type: 'GH_ORG'
            })
          })
      });

      it('should create a group for a GitHub repo', function() {
        var groupUri = fixtureLoader.GITTER_INTEGRATION_REPO;
        var linkPath = fixtureLoader.GITTER_INTEGRATION_REPO_FULL;
        var user = fixture.user1;
        return groupService.createGroup(user, {
            type: 'GH_REPO',
            name: 'Bob',
            uri: groupUri,
            linkPath: linkPath
          })
          .then(function(group) {
            assert.strictEqual(group.name, 'Bob');
            assert.strictEqual(group.uri, groupUri);
            assert.strictEqual(group.lcUri, groupUri.toLowerCase());
            return securityDescriptorService.getForGroupUser(group._id, null);
          })
          .then(function(securityDescriptor) {
            assert.deepEqual(securityDescriptor, {
              admins: 'GH_REPO_PUSH',
              externalId: fixtureLoader.GITTER_INTEGRATION_REPO_ID,
              linkPath: linkPath,
              members: 'PUBLIC',
              public: true,
              type: 'GH_REPO'
            })
          })
      });

      it('should create a group for an unknown GitHub owner', function() {
        var user = fixture.user1;
        return groupService.createGroup(user, {
            type: 'GH_GUESS',
            name: 'Bob',
            // This also tests that you can have a group with an arbitrary uri
            // that is backed by a github user/org with a linkPath that is
            // different to the group's uri.
            uri: 'Bob',
            linkPath: fixtureLoader.GITTER_INTEGRATION_USERNAME
          })
          .then(function(group) {
            assert.strictEqual(group.name, 'Bob');
            assert.strictEqual(group.uri, 'Bob');
            assert.strictEqual(group.lcUri, 'bob');
            return securityDescriptorService.getForGroupUser(group._id, null);
          })
          .then(function(securityDescriptor) {
            assert.deepEqual(securityDescriptor, {
              admins: 'GH_USER_SAME',
              externalId: fixtureLoader.GITTER_INTEGRATION_USER_ID,
              linkPath: fixtureLoader.GITTER_INTEGRATION_USERNAME,
              members: 'PUBLIC',
              public: true,
              type: 'GH_USER'
            })
          })
      });

      it('should create a group for a new style community', function() {
        var user = fixture.user1;
        return groupService.createGroup(user, {
            name: 'Bob',
            uri: fixtureLoader.GITTER_INTEGRATION_COMMUNITY
          })
          .then(function(group) {
            assert.strictEqual(group.name, 'Bob');
            assert.strictEqual(group.uri, fixtureLoader.GITTER_INTEGRATION_COMMUNITY);
            assert.strictEqual(group.lcUri, fixtureLoader.GITTER_INTEGRATION_COMMUNITY.toLowerCase());
            return securityDescriptorService.getForGroupUser(group._id, null);
          })
          .then(function(securityDescriptor) {
            assert.deepEqual(securityDescriptor, {
              type: null,
              admins: 'MANUAL',
              public: true,
              members: 'PUBLIC'
            })
          })
      });

      it('should throw a 409 if a URL is not available', function() {
        var user = fixture.user1;
        var groupService = proxyquireNoCallThru('../lib/group-service', {
          './group-uri-checker': function() {
            return Promise.resolve({
              allowCreate: false
            });
          }
        });
        groupService.createGroup(user, {
            name: 'Bob',
            uri: 'bob'
          })
          .then(function() {
            assert.ok(false, 'Error Expected');
          })
          .catch(StatusError, function(err) {
            assert.strictEqual(err.status, 409);
          });
      });
    });

    describe('findById #slow', function() {
      var fixture = fixtureLoader.setup({
        group1: {},
      });

      it('should find a group', function() {
        return groupService.findById(fixture.group1._id)
          .then(function(group) {
            assert.strictEqual(group.name, fixture.group1.name);
            assert.strictEqual(group.uri, fixture.group1.uri);
            assert.strictEqual(group.lcUri, fixture.group1.lcUri);
          });

      });
    });

    describe('ensureGroupForGitHubRoomCreation', function() {
      var fixture = fixtureLoader.setup({
        deleteDocuments: {
          User: [{ username: fixtureLoader.GITTER_INTEGRATION_USERNAME }],
          Group: [{ lcUri: fixtureLoader.GITTER_INTEGRATION_USERNAME.toLowerCase() }],
        },
        user1: {
          githubToken: fixtureLoader.GITTER_INTEGRATION_USER_SCOPE_TOKEN,
          username: fixtureLoader.GITTER_INTEGRATION_USERNAME
        }
      });

      it('should create a room for a repo', function() {
        return groupService.migration.ensureGroupForGitHubRoomCreation(fixture.user1, {
          uri: fixtureLoader.GITTER_INTEGRATION_ORG,
          name: 'BOB',
          obtainAccessFromGitHubRepo: fixtureLoader.GITTER_INTEGRATION_REPO_FULL
        })
        .then(function(group) {
          return securityDescriptorService.getForGroupUser(group._id, fixture.user1._id);
        })
        .then(function(securityDescriptor) {
          assert.deepEqual({
            admins: "GH_ORG_MEMBER",
            externalId: fixtureLoader.GITTER_INTEGRATION_ORG_ID,
            linkPath: "gitter-integration-tests-organisation",
            members: "PUBLIC",
            public: true,
            type: "GH_ORG",
          }, securityDescriptor);
        })

      });

      it('should create a room for a user', function() {
        return groupService.migration.ensureGroupForGitHubRoomCreation(fixture.user1, {
          uri: fixture.user1.username,
          name: 'BOB'
        })
        .then(function(group) {
          return securityDescriptorService.getForGroupUser(group._id, fixture.user1._id);
        })
        .then(function(securityDescriptor) {
          assert.strictEqual(securityDescriptor.admins, 'GH_USER_SAME');
          assert.strictEqual(securityDescriptor.externalId, fixtureLoader.GITTER_INTEGRATION_USER_ID);
          assert.deepEqual(securityDescriptor.extraAdmins, []);
          assert.equal(securityDescriptor.public, true);
          assert.equal(securityDescriptor.members, 'PUBLIC');
          assert.equal(securityDescriptor.linkPath, fixtureLoader.GITTER_INTEGRATION_USERNAME);
          assert.equal(securityDescriptor.type, 'GH_USER');
        });
      });
    });

    describe('findRoomsIdForGroup', function() {
      var fixture = fixtureLoader.setup({
        user1: {},
        user2: {},
        group1: {},
        troupe1: { group: 'group1', security: 'PUBLIC' },
        troupe2: { group: 'group1', security: 'PUBLIC' },
        troupe3: { group: 'group1', security: 'PRIVATE', users: ['user1'] },
        troupe4: { group: 'group1', security: 'PRIVATE' },
      });

      it('should find the roomIds for group for an anonymous user', function() {
        return groupService.findRoomsIdForGroup(fixture.group1._id)
          .then(function(roomIds) {
            var roomStrings = roomIds.map(String);
            roomStrings.sort();

            var expectedStrings = [
              fixture.troupe1.id,
              fixture.troupe2.id,
            ];
            expectedStrings.sort();

            assert.deepEqual(roomStrings, expectedStrings);
          });
      });

      it('should find the roomIds for group and user with troupes', function() {
        return groupService.findRoomsIdForGroup(fixture.group1._id, fixture.user1._id)
          .then(function(roomIds) {
            compareSets(roomIds.map(String), [
              fixture.troupe1.id,
              fixture.troupe2.id,
              fixture.troupe3.id
            ]);
          });
      });

      it('should find the roomIds for group and user without troupes', function() {
        return groupService.findRoomsIdForGroup(fixture.group1._id, fixture.user2._id)
          .then(function(roomIds) {
            compareSets(roomIds.map(String), [
              fixture.troupe1.id,
              fixture.troupe2.id,
            ]);
          });
      });
    });

    describe('setForumForGroup', function() {
      var fixture = fixtureLoader.setup({
        group1: {},
        group2: { forum: 'forum2' },
        forum1: {},
        forum2: {}
      });

      it("should set a group's forum", function() {
        return groupService.setForumForGroup(fixture.group1._id, fixture.forum1._id)
          .then(function(group) {
            assert.ok(mongoUtils.objectIDsEqual(group.forumId, fixture.forum1.id));
          });
      });

      it("should throw an error if the group already has a forum", function() {
        return groupService.setForumForGroup(fixture.group2._id, fixture.forum1._id)
          .then(function() {
            assert.ok(false, "Expected error.");
          })
          .catch(StatusError, function(err) {
            assert.strictEqual(err.status, 409);
          });
      });
    });

  });

})
