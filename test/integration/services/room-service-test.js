"use strict";

var testRequire = require('../test-require');
var assert = require('assert');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var Promise = require('bluebird');
var ObjectID = require('mongodb').ObjectID;
var StatusError = require('statuserror');
var fixture = {};

var mockito = require('jsmockito').JsMockito;
var times = mockito.Verifiers.times;
var once = times(1);

var persistence = require('gitter-web-persistence');
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');
var roomMembershipService = testRequire('./services/room-membership-service');
var securityDescriptorValidator = require('gitter-web-permissions/lib/security-descriptor-validator');

testRequire("./services/room-service");

// to work around proxyquire caching bugs...
testRequire("./services/room-service");

describe('room-service', function() {
  before(fixtureLoader(fixture, {
    deleteDocuments: {
      Troupe: [{ lcUri: 'gittertest' }]
    },
    user1: { },
    user2: { },
    user3: { },
    troupeOrg1: {
      githubType: 'ORG',
      users: ['user1', 'user2']
    },
    troupeEmptyOrg: {
      githubType: 'ORG',
      users: []
    },
    troupeRepo: {
      security: 'PRIVATE',
      githubType: 'REPO',
      users: ['user1', 'user2']
    },
    troupeCanRemove: {
      security: 'PUBLIC',
      githubType: 'REPO',
      users: ['userToRemove', 'userRemoveNonAdmin', 'userRemoveAdmin']
    },
    troupeCannotRemove: {
      security: 'PRIVATE',
      githubType: 'ONETOONE',
      users: ['userToRemove', 'userRemoveAdmin']
    },
    group1: {},
    userToRemove: {},
    userRemoveNonAdmin: {},
    userRemoveAdmin: {}
  }));

  after(function() {
    fixture.cleanup();
  });

  describe('classic functionality #slow', function() {
    it('should fail to create a room for an org where the user is not an admin', function () {

      var roomService = testRequire.withProxies("./services/room-service", {
        'gitter-web-permissions/lib/github-policy-factory': {
          createPolicyForGithubObject: function() {
            return Promise.resolve({
              canAdmin: function() {
                return Promise.resolve(false);
              }
            });
          }
        }
      });

      return roomService.createRoomByUri(fixture.user1, 'gitterTest')
        .then(function () {
          assert(false, 'Expected an exception');
        })
        .catch(StatusError, function(err) {
          assert.strictEqual(err.status, 403);
        });
    });

    it('should disallow users from accessing rooms they cannot join #slow', function () {
      var uriResolver = mockito.mockFunction();
      var roomService = testRequire.withProxies('./services/room-service', {
        './uri-resolver': uriResolver,
        'gitter-web-permissions/lib/policy-factory': {
          createPolicyForRoom: function() {
            return Promise.resolve({
              canJoin: function() {
                return Promise.resolve(false);
              }
            });
          }
        }
      });

      mockito
        .when(uriResolver)()
        .then(function () {
          return Promise.resolve({
            room: {
              _id: '5436981c00062eebf0fbc0d5',
              githubType: 'ORG',
              uri: 'gitterTest',
              security: null,
              bans: [],
              oneToOne: false,
              status: 'ACTIVE',
              lcUri: 'gitterhq',
              tags: [],
              topic: 'Gitter',
            },
            roomMember: false
          });
        });

      // test
      return roomService
        .createRoomByUri(fixture.user1, 'gitterTest')
        .then(function () {
          assert(false, 'Expected an exception');
        })
        .catch(StatusError, function(err) {
          assert.strictEqual(err.status, 404);
        });
    });


    it('should find or create a room for an organization', function() {
      var groupId = new ObjectID();
      var uriResolver = mockito.mockFunction();
      var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');

      var roomService = testRequire.withProxies("./services/room-service", {
        './uri-resolver': uriResolver,
        'gitter-web-groups/lib/group-service': {
          migration: {
            ensureGroupForGitHubRoomCreation: function(pUser, options) {
              assert.strictEqual(pUser, fixture.user1);
              assert.deepEqual(options, {
                uri: 'gitterTest'
              });
              return Promise.resolve({ _id: groupId });
            }
          }
        },
        'gitter-web-permissions/lib/github-policy-factory': {
          createPolicyForGithubObject: function(user, uri, ghType, security) {
            assert.equal(user.username, fixture.user1.username);
            assert.equal(uri, 'gitterTest');
            assert.equal(ghType, 'ORG');
            assert.equal(security, null);

            return Promise.resolve({
              canAdmin: function() {
                return Promise.resolve(true);
              }
            });
          }
        },
        'gitter-web-permissions/lib/policy-factory': {
          createPolicyForRoom: function(user, room) {
            assert.equal(room.uri, 'gitterTest');
            return Promise.resolve({});
          }
        }
      });

      mockito.when(uriResolver)()
        .then(function () {
          return Promise.resolve(null);
        });

      return roomService
        .createRoomByUri(fixture.user1, 'gitterTest')
        .bind({})
        .then(function (uriContext) {
          this.uriContext = uriContext;
          assert(uriContext.didCreate);
          assert.equal(uriContext.troupe.uri, 'gitterTest');
          assert.equal(uriContext.troupe.userCount, 0);

          return securityDescriptorService.getForRoomUser(uriContext.troupe._id, fixture.user1._id);
        })
        .then(function(securityDescriptor) {
          securityDescriptorValidator(securityDescriptor);
          assert.deepEqual(securityDescriptor, {
            admins: "GH_ORG_MEMBER",
            externalId: this.uriContext.troupe.githubId,
            linkPath: "gitterTest",
            members: "GH_ORG_MEMBER",
            public: false,
            type: "GH_ORG"
          });
        })
        .finally(function () {
          return persistence.Troupe.remove({ uri: 'gitterTest' }).exec();
        });
    });

    it('should find or create a room for a person', function() {
      var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
      var roomService = testRequire("./services/room-service");

      return roomService.createRoomByUri(fixture.user1, fixture.user2.username)
        .bind({})
        .then(function(uriContext) {
          this.uriContext = uriContext;
          assert(uriContext.troupe);
          return securityDescriptorService.getForRoomUser(uriContext.troupe._id, fixture.user1._id);
        })
        .then(function(securityDescriptor) {
          securityDescriptorValidator(securityDescriptor);

          assert.deepEqual(securityDescriptor, {
            extraAdmins: [],
            extraMembers: [],
            public: false,
            type: "ONE_TO_ONE"
          });
        });
    });

    it('should create a room for a repo', function() {
      var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
      var groupId = new ObjectID();
      var roomService = testRequire.withProxies("./services/room-service", {
        'gitter-web-groups/lib/group-service': {
          migration: {
            ensureGroupForGitHubRoomCreation: function(pUser, options) {
              assert.strictEqual(pUser, fixture.user1);
              assert.deepEqual(options, {
                obtainAccessFromGitHubRepo: "gitterHQ/cloaked-avenger",
                uri: "gitterHQ"
              });
              return Promise.resolve({ _id: groupId });
            }
          }
        },
        'gitter-web-permissions/lib/github-policy-factory': {
          createPolicyForGithubObject: function(user, uri, ghType, security) {
            assert.equal(user.username, fixture.user1.username);
            assert.equal(uri, 'gitterHQ/cloaked-avenger');
            assert.equal(ghType, 'REPO');
            assert.equal(security, null);

            return Promise.resolve({
              canAdmin: function() {
                return Promise.resolve(true);
              }
            });
          }
        },
        'gitter-web-permissions/lib/policy-factory': {
          createPolicyForRoom: function(user, room) {
            assert.equal(room.uri, 'gitterHQ/cloaked-avenger');
            assert.equal(room.groupId, groupId);
            return Promise.resolve({});
          }
        }
      });

      return persistence.Troupe.findOneAndRemove({ lcUri: 'gitterhq/cloaked-avenger' })
        .then(function() {
          return roomService.createRoomByUri(fixture.user1, 'gitterHQ/cloaked-avenger');
        })
        .bind({})
        .then(function(uriContext) {
          this.uriContext = uriContext;
          return securityDescriptorService.getForRoomUser(uriContext.troupe._id, fixture.user1._id);
        })
        .then(function(securityDescriptor) {
          securityDescriptorValidator(securityDescriptor);

          assert.deepEqual(securityDescriptor, {
            admins: "GH_REPO_PUSH",
            externalId: this.uriContext.troupe.githubId,
            linkPath: 'gitterHQ/cloaked-avenger',
            members: "PUBLIC",
            public: true,
            type: "GH_REPO"
          });

          return roomMembershipService.checkRoomMembership(this.uriContext.troupe._id, fixture.user1._id);
        })
        .then(function(isRoomMember) {
          assert.strictEqual(isRoomMember, true);
        });
    });

    it('should add a user to a room if the room exists', function() {
      var groupId = new ObjectID();
      var roomService = testRequire.withProxies("./services/room-service", {
        'gitter-web-groups/lib/group-service': {
          migration: {
            ensureGroupForGitHubRoomCreation: function(pUser, options) {
              assert.strictEqual(pUser, fixture.user1);
              assert.deepEqual(options, {
                obtainAccessFromGitHubRepo: "gitterHQ/cloaked-avenger",
                uri: "gitterHQ"
              });
              return Promise.resolve({ _id: groupId });
            }
          }
        },
        'gitter-web-permissions/lib/github-policy-factory': {
          createPolicyForGithubObject: function(user, uri, ghType, security) {
            assert.equal(user.username, fixture.user1.username);
            assert.equal(uri, 'gitterHQ/cloaked-avenger');
            assert.equal(ghType, 'REPO');
            assert.equal(security, null);

            return Promise.resolve({
              canAdmin: function() {
                return Promise.resolve(true);
              }
            });
          },
        },
        'gitter-web-permissions/lib/policy-factory': {
          createPolicyForRoom: function(user, room) {
            assert.equal(room.uri, 'gitterHQ/cloaked-avenger');
            return Promise.resolve({
              canJoin: function() {
                return Promise.resolve(true);
              }
            });
          }
        }
      });

      return persistence.Troupe.findOneAndRemove({ lcUri: 'gitterhq/cloaked-avenger' })
        .then(function() {
          return roomService.createRoomByUri(fixture.user1, 'gitterHQ/cloaked-avenger');
        })
        .bind({})
        .then(function(uriContext) {
          this.uriContext = uriContext;
          return roomMembershipService.removeRoomMember(this.uriContext.troupe._id, fixture.user1._id);
        })
        .then(function() {
          return roomMembershipService.checkRoomMembership(this.uriContext.troupe._id, fixture.user1._id);
        })
        .then(function(isRoomMember) {
          assert.strictEqual(isRoomMember, false);
          return roomService.createRoomByUri(fixture.user1, 'gitterHQ/cloaked-avenger');
        })
        .then(function() {
          return roomMembershipService.checkRoomMembership(this.uriContext.troupe._id, fixture.user1._id);
        })
        .then(function(isRoomMember) {
          assert.strictEqual(isRoomMember, true);
        });
    });

    it('should create a room for a repo ignoring the case', function() {
      var groupId = new ObjectID();

      var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
      var roomService = testRequire.withProxies("./services/room-service", {
        'gitter-web-groups/lib/group-service': {
          migration: {
            ensureGroupForGitHubRoomCreation: function(pUser, options) {
              assert.strictEqual(pUser, fixture.user1);
              assert.deepEqual(options, {
                uri: 'gitterHQ',
                obtainAccessFromGitHubRepo: "gitterHQ/sandbox"
              });
              return Promise.resolve({ _id: groupId });
            }
          }
        },
        'gitter-web-permissions/lib/github-policy-factory': {
          createPolicyForGithubObject: function(user, uri, ghType, security) {
            assert.equal(user.username, fixture.user1.username);
            assert.equal(uri, 'gitterHQ/sandbox');
            assert.equal(ghType, 'REPO');
            assert.equal(security, null);

            return Promise.resolve({
              canAdmin: function() {
                return Promise.resolve(true);
              }
            });
          },
        },
        'gitter-web-permissions/lib/policy-factory': {
          createPolicyForRoom: function(user, room) {
            assert.equal(room.uri, 'gitterHQ/sandbox');
            return Promise.resolve({});
          }
        }
      });

      return persistence.Troupe.findOneAndRemove({ lcUri: 'gitterhq/sandbox' })
        .exec()
        .bind({})
        .then(function() {
          return roomService.createRoomByUri(fixture.user1, 'gitterhq/sandbox', { ignoreCase: true });
        })
        .then(function(uriContext) {
          this.uriContext = uriContext;
          assert(uriContext.troupe);
          assert(uriContext.troupe.lcUri === 'gitterhq/sandbox');
          assert(uriContext.troupe.uri === 'gitterHQ/sandbox');

          return securityDescriptorService.getForRoomUser(uriContext.troupe._id, fixture.user1._id);
        })
        .then(function(securityDescriptor) {
          securityDescriptorValidator(securityDescriptor);

          assert.deepEqual(securityDescriptor, {
            admins: "GH_REPO_PUSH",
            externalId: this.uriContext.troupe.githubId,
            linkPath: 'gitterHQ/sandbox',
            members: "PUBLIC",
            public: true,
            type: "GH_REPO"
          });

          return roomMembershipService.checkRoomMembership(this.uriContext.troupe._id, fixture.user1._id);
        })
        .then(function(isRoomMember) {
          assert.strictEqual(isRoomMember, true);
        });
    });

    it('should detect when a user hits their own userhome', function() {
      var roomService = testRequire("./services/room-service");

      return roomService.createRoomByUri(fixture.user1, fixture.user1.username)
        .then(function() {
          assert.ok(false, 'Expected an exception');
        })
        .catch(StatusError, function(err) {
          assert.strictEqual(err.status, 404);
        });
    });

    it('should redirect a user when a URI is in the wrong case and the room is to be created', function() {
      var roomService = testRequire("./services/room-service");

      return persistence.Troupe.findOneAndRemove({ lcUri: 'gitterhq/sandbox' })
        .exec()
        .then(function() {
          return roomService.createRoomByUri(fixture.user1, 'gitterhq/sandbox');
        })
        .then(function() {
          assert(false, 'Expected redirect');
        }, function(err) {
          assert.strictEqual(err.status, 301);
          assert.strictEqual(err.path, '/gitterHQ/sandbox');
        });

    });

    it('should handle a user trying to create a room they dont have access to', function() {
      var roomService = testRequire("./services/room-service");

      return roomService.createRoomByUri(fixture.user1, 'joyent')
        .then(function () {
          assert(false, 'Expected exception');
        })
        .catch(StatusError, function(err) {
          assert.strictEqual(err.status, 403);
        });
    });

    it('should return an accessDenied if a user attempts to access an org which they dont have access to', function() {
      var roomService = testRequire.withProxies("./services/room-service", {
        'gitter-web-permissions/lib/policy-factory': {
          createPolicyForRoom: function(user, room) {
            assert.strictEqual(room.id, fixture.troupeOrg1.id);
            assert.strictEqual(user, fixture.user3);

            return Promise.resolve({
              canJoin: function() {
                return Promise.resolve(false);
              }
            });
          }
        }
      });

      return roomService.createRoomByUri(fixture.user3, fixture.troupeOrg1.uri)
        .then(function() {
          assert(false, 'Expected exception');
        })
        .catch(StatusError, function(err) {
          assert.strictEqual(err.status, 404);
        });
    });
  });

  describe('addUserToRoom', function() {
    function createRoomServiceWithStubs(stubs) {
      return testRequire.withProxies("./services/room-service", {
        'gitter-web-permissions/lib/add-invite-policy-factory': {
          createPolicyForRoomAdd: function() {
            return Promise.resolve({
                canJoin: function() {
                  return Promise.resolve(stubs.canBeInvited);
                }
            });
          }
        },
        './email-notification-service': {
          sendInvitation: stubs.onInviteEmail,
          addedToRoomNotification: function() {
            return Promise.resolve();
          }
        },
        './email-address-service': function() {
          return Promise.resolve('a@b.com');
        }
      });
    }

    it('adds a user to the troupe', function() {
      var service = createRoomServiceWithStubs({
        canBeInvited: true,
        onInviteEmail: function() {
          return Promise.resolve();
        }
      });

      var _troupId = new ObjectID();
      var _userId = new ObjectID();
      var _userToAddId = new ObjectID();

      var troupe = {
        _id: _troupId,
        id: _troupId.toString(),
        uri: 'user/room'
      };

      var user = {
        _id: _userId,
        id: _userId.toString()
      };

      var userToAdd = {
        _id: _userToAddId,
        id: _userToAddId.toString(),
        username: 'test-user'
      }

      return service.addUserToRoom(troupe, user, userToAdd);
    });

    it('saves troupe changes', function() {
      var service = createRoomServiceWithStubs({
        canBeInvited: true,
        onInviteEmail: function() {
          return Promise.resolve();
        }
      });

      var _troupId = new ObjectID();
      var _userId = new ObjectID();
      var _userToAddId = new ObjectID();

      var troupe = {
        _id: _troupId,
        id: _troupId.toString(),
        uri: 'user/room'
      };

      var user = {
        _id: _userId,
        id: _userId.toString()
      };

      var userToAdd = {
        _id: _userToAddId,
        id: _userToAddId.toString(),
        username: 'test-user'
      }

      return service.addUserToRoom(troupe, user, userToAdd);
    });

    it('returns the added user and sets the date the user was added', function() {
      var service = createRoomServiceWithStubs({
        canBeInvited: true,
        onInviteEmail: function() {
          return Promise.resolve();
        }
      });

      var _troupId = new ObjectID();
      var _userId = new ObjectID();
      var _userToAddId = new ObjectID();

      var troupe = {
        _id: _troupId,
        uri: 'user/room'
      };

      var user = {
        _id: _userId,
        id: _userId.toString()
      };

      var userToAdd = {
        _id: _userToAddId,
        id: _userToAddId.toString(),
        username: 'test-user'
      }

      return service.addUserToRoom(troupe, user, userToAdd)
        .then(function(user) {
          assert.equal(user.id, _userToAddId);
          assert.equal(user.username, 'test-user');

          return persistence.UserTroupeLastAccess.findOne({ userId: user.id }).exec();
        })
        .then(function(lastAccess) {
          assert(lastAccess);
          assert(lastAccess.added);
          assert(lastAccess.added[troupe.id]);
          assert(Date.now() - lastAccess.added[troupe.id] <= 30000);
        });
    });

    it('attempts an email invite for new users', function() {
      var service = createRoomServiceWithStubs({
        canBeInvited: true,
        onInviteEmail: function() {
          return Promise.resolve();
        }
      });

      var _troupId = new ObjectID();
      var _userId = new ObjectID();
      var _userToAddId = new ObjectID();

      var troupe = {
        _id: _troupId,
        uri: 'user/room'
      };

      var user = {
        _id: _userId,
        id: _userId.toString()
      };

      var userToAdd = {
        _id: _userToAddId,
        id: _userToAddId.toString(),
        username: 'test-user'
      }

      return service.addUserToRoom(troupe, user, userToAdd);
    });

    it('fails with 403 when adding someone to who cant be invited', function() {
      var service = createRoomServiceWithStubs({
        findByUsernameResult: null,
        createInvitedUserResult: { username: 'test-user', id: 'test-user-id', state: 'INVITED' },
        canBeInvited: false,
        onInviteEmail: function() {
          return Promise.resolve();
        }
      });

      var _userToAddId = new ObjectID();

      var troupe = {
        uri: 'user/room'
      };

      var userToAdd = {
        _id: _userToAddId,
        id: _userToAddId.toString(),
        username: 'test-user'
      };

      return service.addUserToRoom(troupe, {}, userToAdd)
        .then(function() {
          assert.ok(false, 'Expected exception');
        }, function(err) {
          assert.equal(err.status, 403);
        });
    });

    it('should not fail when adding someone who is already in the room', function() {
      var service = createRoomServiceWithStubs({
        canBeInvited: true,
        onInviteEmail: function() {
          return Promise.resolve();
        }
      });

      var _troupId = new ObjectID();
      var _userId = new ObjectID();
      var _userToAddId = new ObjectID();

      var troupe = {
        _id: _troupId,
        uri: 'user/room'
      };

      var user = {
        _id: _userId,
        id: _userId.toString()
      };

      var userToAdd = {
        _id: _userToAddId,
        id: _userToAddId.toString(),
        username: 'test-user'
      };

      return service.addUserToRoom(troupe, user, userToAdd);
    });
  });

  describe('channel creation #slow', function() {
    function createMockAddInvitePolicyFactory(canBeInvited) {
      return {
        createPolicyForRoomAdd: function() {
          return Promise.resolve({
              canJoin: function() {
                return Promise.resolve(canBeInvited);
              }
          });
        }
      }
    }

    describe('org channels', function() {

      it('should create private rooms and allow users to be added to them', function() {
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForRoom: function(parentTroupe, user) {
                assert.strictEqual(parentTroupe, fixture.troupeOrg1);
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });
        var roomMembershipService = testRequire('./services/room-membership-service');

        return roomService.createRoomChannel(fixture.troupeOrg1, fixture.user1, {
            name: 'private',
            security: 'PRIVATE'
          })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.parentId, fixture.troupeOrg1._id));
            assert(mongoUtils.objectIDsEqual(room.groupId, fixture.group1._id));
            return room;
          })
          .tap(function(room) {
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3);
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(isMember) {
            assert(isMember, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.deepEqual(securityDescriptor, {
              admins: "GH_ORG_MEMBER",
              externalId: fixture.troupeOrg1.githubId,
              linkPath: fixture.troupeOrg1.uri,
              members: "INVITE",
              public: false,
              type: "GH_ORG"
            });
          });
      });

      it('should create open rooms', function() {
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-permissions/lib/add-invite-policy-factory': createMockAddInvitePolicyFactory(true),
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForRoom: function(parentTroupe, user) {
                assert.strictEqual(parentTroupe, fixture.troupeOrg1);
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomMembershipService = testRequire('./services/room-membership-service');

        return roomService.createRoomChannel(fixture.troupeOrg1, fixture.user1, {
            name: 'open',
            security: 'PUBLIC'
          })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.parentId, fixture.troupeOrg1._id));
            assert(mongoUtils.objectIDsEqual(room.groupId, fixture.group1._id));
            return room;
          })
          .tap(function(room) {
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3);
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(isMember) {
            assert(isMember, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.deepEqual(securityDescriptor, {
              admins: "GH_ORG_MEMBER",
              externalId: fixture.troupeOrg1.githubId,
              linkPath: fixture.troupeOrg1.uri,
              members: "PUBLIC",
              public: true,
              type: "GH_ORG"
            });
          });
      });

      it('should create inherited rooms', function() {
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-permissions/lib/add-invite-policy-factory': createMockAddInvitePolicyFactory(true),
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForRoom: function(parentTroupe, user) {
                assert.strictEqual(parentTroupe, fixture.troupeOrg1);
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomMembershipService = testRequire('./services/room-membership-service');

        return roomService.createRoomChannel(fixture.troupeOrg1, fixture.user1, {
            name: 'child',
            security: 'INHERITED'
          })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.parentId, fixture.troupeOrg1._id));
            assert(mongoUtils.objectIDsEqual(room.groupId, fixture.group1._id));
            return room;
          })
          .tap(function(room) {
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3);
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(isMember) {
            assert(isMember, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.deepEqual(securityDescriptor, {
              admins: "GH_ORG_MEMBER",
              externalId: fixture.troupeOrg1.githubId,
              linkPath: fixture.troupeOrg1.uri,
              members: "GH_ORG_MEMBER",
              public: false,
              type: "GH_ORG"
            });
          });
      });

      it('should create inherited rooms for empty orgs', function() {
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-permissions/lib/add-invite-policy-factory': createMockAddInvitePolicyFactory(true),
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForRoom: function(parentTroupe, user) {
                assert.strictEqual(parentTroupe, fixture.troupeEmptyOrg);
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomMembershipService = testRequire('./services/room-membership-service');

        return roomService.createRoomChannel(fixture.troupeEmptyOrg, fixture.user1, {
            name: 'child',
            security: 'INHERITED'
          })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.parentId, fixture.troupeEmptyOrg._id));
            assert(mongoUtils.objectIDsEqual(room.groupId, fixture.group1._id));
            return room;
          })
          .tap(function(room) {
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3)
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(isMember) {
            assert(isMember, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.deepEqual(securityDescriptor, {
              admins: "GH_ORG_MEMBER",
              externalId: fixture.troupeEmptyOrg.githubId,
              linkPath: fixture.troupeEmptyOrg.uri,
              members: "GH_ORG_MEMBER",
              public: false,
              type: "GH_ORG"
            });
          });
      });

    });

    describe('repo channels', function() {
      it(/* ::repo */ 'should create private rooms', function() {
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForRoom: function(parentTroupe, user) {
                assert.strictEqual(parentTroupe, fixture.troupeRepo);
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomMembershipService = testRequire('./services/room-membership-service');

        return roomService.createRoomChannel(fixture.troupeRepo, fixture.user1, {
            name: 'private',
            security: 'PRIVATE'
          })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.parentId, fixture.troupeRepo._id));
            assert(mongoUtils.objectIDsEqual(room.groupId, fixture.group1._id));
            return room;
          })
          .tap(function(room) {
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3);
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(isMember) {
            assert(isMember, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.deepEqual(securityDescriptor, {
              admins: "GH_REPO_PUSH",
              externalId: fixture.troupeRepo.githubId,
              linkPath: fixture.troupeRepo.uri,
              members: "INVITE",
              public: false,
              type: "GH_REPO"
            });
          });
      });

      it(/* ::repo */ 'should create open rooms', function() {
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomMembershipService = testRequire('./services/room-membership-service');
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForRoom: function(parentTroupe, user) {
                assert.strictEqual(parentTroupe, fixture.troupeRepo);
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });

        return roomService.createRoomChannel(fixture.troupeRepo, fixture.user1, {
            name: 'open',
            security: 'PUBLIC'
          })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.parentId, fixture.troupeRepo._id));
            assert(mongoUtils.objectIDsEqual(room.groupId, fixture.group1._id));
            return room;
          })
          .tap(function(room) {
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3);
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(isMember) {
            assert(isMember, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.deepEqual(securityDescriptor, {
              admins: "GH_REPO_PUSH",
              externalId: fixture.troupeRepo.githubId,
              linkPath: fixture.troupeRepo.uri,
              members: "PUBLIC",
              public: true,
              type: "GH_REPO"
            });
          });
      });

      it(/* ::repo */ 'should create inherited rooms', function() {
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-permissions/lib/add-invite-policy-factory': createMockAddInvitePolicyFactory(true),
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForRoom: function(parentTroupe, user) {
                assert.strictEqual(parentTroupe, fixture.troupeRepo);
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomMembershipService = testRequire('./services/room-membership-service');

        return roomService.createRoomChannel(fixture.troupeRepo, fixture.user1, {
            name: 'child',
            security: 'INHERITED'
          })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.parentId, fixture.troupeRepo._id));
            assert(mongoUtils.objectIDsEqual(room.groupId, fixture.group1._id));
            return room;
          })
          .tap(function(room) {
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3);
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(isMember) {
            assert(isMember, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.deepEqual(securityDescriptor, {
              admins: "GH_REPO_PUSH",
              externalId:  fixture.troupeRepo.githubId,
              linkPath: fixture.troupeRepo.uri,
              members: "GH_REPO_ACCESS",
              public: false,
              type: "GH_REPO"
            });
          });
      });

    });

    describe('::user::', function() {

      it('should create private rooms without a name', function() {
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomMembershipService = testRequire('./services/room-membership-service');
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForUser: function(user) {
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });

        return roomService.createUserChannel(fixture.user1, { security: 'PRIVATE' })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.ownerUserId, fixture.user1._id));
            assert(mongoUtils.objectIDsEqual(room.groupId, fixture.group1._id));
            return room;
          })
          .tap(function(room) {
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3);
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(userIsInRoom) {
            assert(userIsInRoom, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.strictEqual(securityDescriptor.extraAdmins.length, 1);
            assert.strictEqual(String(securityDescriptor.extraAdmins[0]), fixture.user1.id);

            delete securityDescriptor.extraAdmins;
            assert.deepEqual(securityDescriptor, {
              admins: "MANUAL",
              members: "INVITE",
              public: false,
              type: null
            });
          });
      });

      it('should create private rooms with name', function() {
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomMembershipService = testRequire('./services/room-membership-service');
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForUser: function(user) {
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });

        return roomService.createUserChannel(fixture.user1, { name: 'private', security: 'PRIVATE' })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.ownerUserId, fixture.user1._id));
            assert(mongoUtils.objectIDsEqual(room.groupId, fixture.group1._id));
            return room;
          })
          .tap(function(room) {
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3);
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(isMember) {
            assert(isMember, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.strictEqual(securityDescriptor.extraAdmins.length, 1);
            assert.strictEqual(String(securityDescriptor.extraAdmins[0]), fixture.user1.id);

            delete securityDescriptor.extraAdmins;
            assert.deepEqual(securityDescriptor, {
              admins: "MANUAL",
              members: "INVITE",
              public: false,
              type: null
            });

          });
      });

      it('should create open rooms', function() {
        var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor-service');
        var roomMembershipService = testRequire('./services/room-membership-service');
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForUser: function(user) {
                assert.strictEqual(user, fixture.user1);
                return Promise.resolve(fixture.group1);
              }
            }
          }
        });
        return roomService.createUserChannel(fixture.user1, { name: 'open', security: 'PUBLIC' })
          .bind({})
          .then(function(room) {
            this.room = room;
            assert(mongoUtils.objectIDsEqual(room.ownerUserId, fixture.user1._id));
            return room;
          })
          .tap(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            return roomService.addUserToRoom(room, fixture.user1, fixture.user3);
          })
          .then(function(room) {
            return roomMembershipService.checkRoomMembership(room.id, fixture.user3.id);
          })
          .then(function(userIsInRoom) {
            assert(userIsInRoom, 'Expected to find newly added user in the room');
            return securityDescriptorService.getForRoomUser(this.room._id, fixture.user1._id);
          })
          .then(function(securityDescriptor) {
            securityDescriptorValidator(securityDescriptor);

            assert.strictEqual(securityDescriptor.extraAdmins.length, 1);
            assert.strictEqual(String(securityDescriptor.extraAdmins[0]), fixture.user1.id);

            delete securityDescriptor.extraAdmins;
            assert.deepEqual(securityDescriptor, {
              admins: "MANUAL",
              members: "PUBLIC",
              public: true,
              type: null
            });
          });
      });

      it('should NOT create child rooms', function() {
        var roomService = testRequire("./services/room-service");

        return roomService.createUserChannel(fixture.user1, { name: 'inherited', security: 'INHERITED' })
          .then(function() {
            assert.ok(false, 'Expected a reject');
          })
          .catch(StatusError, function(err) {
            assert.strictEqual(err.status, 400);
          });
      });

      it('should be able to delete rooms #slow', function() {
        var troupeService = testRequire('./services/troupe-service');
        var roomService = testRequire.withProxies("./services/room-service", {
          'gitter-web-groups/lib/group-service': {
            migration: {
              ensureGroupForUser: function() {
                return Promise.resolve(null);
              }
            }
          }
        });

        return roomService.createUserChannel(fixture.user1, { name: 'tobedeleted', security: 'PUBLIC' })
          .then(function(room) {
            return room;
          })
          .then(function(room) {
            return roomService.deleteRoom(room)
              .thenReturn(room.lcUri);
          })
          .then(function(roomUri) {
            return troupeService.findByUri(roomUri);
          })
          .then(function(room) {
            assert(room === null, 'Expected room to be null after deletion');
          });
      });

    });

  });

  describe('removals', function() {

    var roomService = testRequire.withProxies('./services/room-service', {
      'gitter-web-permissions/lib/policy-factory': {
        createPolicyForRoom: function(user/*, room*/) {
          return Promise.resolve({
            canAdmin: function() {
              if(user.id === fixture.userRemoveNonAdmin.id) {
                return Promise.resolve(false);
              } else if(user.id === fixture.userRemoveAdmin.id) {
                return Promise.resolve(true);
              } else {
                assert(false, 'Unknown user');
              }
              return Promise.resolve(true);
            }
          });
        }
      }
    });

    var userIsInRoom = testRequire('gitter-web-permissions/lib/user-in-room');

    it('should prevent from removing users from one-to-one rooms', function() {
      return userIsInRoom(fixture.troupeCannotRemove.uri, fixture.userToRemove)
        .then(function(here) {
          assert(here);
          return roomService.removeUserFromRoom(fixture.troupeCannotRemove, fixture.userToRemove, fixture.userRemoveAdmin);
        })
        .catch(function(err) {
          assert.equal(err.status, 400);
          assert.equal(err.message, 'This room does not support removing.');
        })
        .then(function() {
          return userIsInRoom(fixture.troupeCannotRemove.uri, fixture.userToRemove);
        })
        .then(function(here) {
          assert(here);
        });
    });

    it('should remove users from rooms', function() {
      return userIsInRoom(fixture.troupeCanRemove.uri, fixture.userToRemove)
        .then(function(here) {
          assert(here);
          return roomService.removeUserFromRoom(fixture.troupeCanRemove, fixture.userToRemove, fixture.userRemoveAdmin);
        })
        .then(function() {
          return userIsInRoom(fixture.troupeCanRemove.uri, fixture.userToRemove);
        })
        .then(function(here) {
          assert(!here);
        });
    });

  });

  describe('remove and hide #slow', function() {
    var troupeService = testRequire('./services/troupe-service');
    var recentRoomService = testRequire('./services/recent-room-service');
    // TODO: this should not be used
    var userIsInRoom = testRequire('gitter-web-permissions/lib/user-in-room');
    var recentRoomCore = testRequire('./services/core/recent-room-core');
    var appEvents = testRequire('gitter-web-appevents');

    describe('room-service #slow', function() {

      beforeEach(fixtureLoader(fixture, {
        troupeCanRemove: {
          security: 'PUBLIC',
          githubType: 'REPO',
          users: ['userFavourite', 'userLeave', 'userToRemove', 'userRemoveNonAdmin', 'userRemoveAdmin']
        },
        troupeCannotRemove: {
          security: 'PRIVATE',
          githubType: 'ONETOONE',
          users: ['userToRemove', 'userRemoveAdmin']
        },
        troupeEmpty: {
          security: 'PUBLIC',
          githubType: 'REPO',
          users: []
        },
        userFavourite: {},
        userLeave: {},
        userToRemove: {},
        userRemoveNonAdmin: {},
        userRemoveAdmin: {}
      }));

      afterEach(function() {
        fixture.cleanup();
      });

      describe('#removeFavourite', function() {

        var roomService = testRequire('./services/room-service');

        var getFavs = function() {
          return recentRoomCore.findFavouriteTroupesForUser(fixture.userFavourite.id);
        };

        var createFav = function() {
          return recentRoomService.updateFavourite(fixture.userFavourite.id, fixture.troupeCanRemove.id, true)
          .then(getFavs)
          .then(function(favs) {
            assert(favs[fixture.troupeCanRemove.id]); // Favourite is created
          });
        };

        var checkHere = function() {
          return userIsInRoom(fixture.troupeCanRemove.uri, fixture.userFavourite);
        };

        // Create an event listener with expected parameters
        // If the test keeps pending, it means no event is emitted with these parameters
        var addListenner = function(expected) {

          var promise = new Promise(function(resolve) {
            appEvents.onDataChange2(function(res) {
              // First filter by url and operation, as other events may have been emitted
              if (expected.url && expected.url !== res.url) return;
              if (expected.operation && expected.operation !== res.operation) return;
              // Check model with deepEqual
              if (expected.model) {
                resolve(assert.deepEqual(res.model, expected.model));
              } else {
                resolve();
              }
            });

          });

          return function() {
            return promise;
          };
        };

        beforeEach(function() {
          return createFav();
        });

        it('should remove favourite', function() {
          var checkEvent = addListenner({
            url: '/user/' + fixture.userFavourite.id + '/rooms',
            operation: 'patch',
            model: {
              id: fixture.troupeCanRemove.id,
              favourite: null,
              lastAccessTime: null,
              mentions: 0,
              unreadItems: 0,
              activity: 0
            }
          });

          return roomService.hideRoomFromUser(fixture.troupeCanRemove, fixture.userFavourite.id)
            .then(checkEvent) // Ensure event was emitted
            .then(getFavs)
            .then(function(favs) {
              assert(!favs[fixture.troupeCanRemove.id]); // Favourite is removed
            })
            .then(checkHere)
            .then(function(here) {
              assert(here); // User is still in room
            });
        });

        it('should remove user from the room if mode=mute', function() {
          // Set user as lurking
          return roomMembershipService.setMembershipMode(fixture.userFavourite.id, fixture.troupeCanRemove.id, 'mute', false)
            .then(function() { // Get updated troupe
              return troupeService.findById(fixture.troupeCanRemove.id);
            })
            .then(function(troupe) {
              return roomService.hideRoomFromUser(troupe, fixture.userFavourite.id);
            })
            .then(getFavs)
            .then(function(favs) {
              assert(!favs[fixture.troupeCanRemove.id]); // Favourite is removed
            })
            .then(checkHere)
            .then(function(here) {
              assert(!here); // User has been removed
            });
        });

        it('should remove user from the room if mode=mute', function() {
          // Set user as lurking
          return roomMembershipService.setMembershipMode(fixture.userFavourite.id, fixture.troupeCanRemove.id, 'mute', false)
            .then(function() { // Get updated troupe
              return troupeService.findById(fixture.troupeCanRemove.id);
            })
            .then(function(troupe) {
              return roomService.hideRoomFromUser(troupe, fixture.userFavourite.id);
            })
            .then(getFavs)
            .then(function(favs) {
              assert(!favs[fixture.troupeCanRemove.id]); // Favourite is removed
            })
            .then(checkHere)
            .then(function(here) {
              assert(!here); // User has been removed
            });
        });

        it('should check if the proper event is emitted when the favourite is removed', function() {
          var checkEvent = addListenner({
            url: '/user/' + fixture.userFavourite.id + '/rooms',
            operation: 'remove',
            model: {id: fixture.troupeEmpty.id}
          });

          return userIsInRoom(fixture.troupeEmpty.uri, fixture.userFavourite)
            .then(function(here) {
              assert(!here); // Check that user is not in the room
            })
            .then(function() {
              return roomService.hideRoomFromUser(fixture.troupeEmpty, fixture.userFavourite.id);
            })
            .then(checkEvent) // Ensure event was emitted
            .then(getFavs)
            .then(function(favs) {
              assert(!favs[fixture.troupeEmpty.id]); // Favourite is removed
            });
        });

      });

      describe('#removeUserFromRoom', function() {

        var roomService = testRequire('./services/room-service');

        it('should remove user from room', function() {
          return userIsInRoom(fixture.troupeCanRemove.uri, fixture.userLeave)
            .then(function(here) {
              assert(here);
              return roomService.removeUserFromRoom(fixture.troupeCanRemove, fixture.userLeave, fixture.userLeave);
            })
            .then(function() {
              return userIsInRoom(fixture.troupeCanRemove.uri, fixture.userLeave);
            })
            .then(function(here) {
              assert(!here);
            });
        });

      });

      describe('#removeUserFromRoom', function() {

        var roomService = testRequire('./services/room-service');

        it('should remove users from rooms', function() {
          return userIsInRoom(fixture.troupeCanRemove.uri, fixture.userToRemove)
            .then(function(here) {
              assert(here);
              return roomService.removeUserFromRoom(fixture.troupeCanRemove, fixture.userToRemove, fixture.userRemoveAdmin);
            })
            .then(function() {
              return userIsInRoom(fixture.troupeCanRemove.uri, fixture.userToRemove);
            })
            .then(function(here) {
              assert(!here);
            });
        });

      });

    });

  });

  describe('createRoomForGitHubUri #slow', function() {
    it('should create an empty room for an organization', function() {
      var groupId = new ObjectID();
      var roomService = testRequire.withProxies("./services/room-service", {
        'gitter-web-groups/lib/group-service': {
          migration: {
            ensureGroupForGitHubRoomCreation: function(pUser, options) {
              assert.strictEqual(pUser, fixture.user1);
              assert.deepEqual(options, {
                uri: "gitterTest"
              });
              return Promise.resolve({ _id: groupId });
            }
          }
        },
        'gitter-web-permissions/lib/github-policy-factory': {
          createPolicyForGithubObject: function(user, uri, githubType, security) {
            assert.strictEqual(user.username, fixture.user1.username);
            assert.strictEqual(uri, 'gitterTest');
            assert.strictEqual(githubType, 'ORG');
            assert.strictEqual(security, null);
            return Promise.resolve({
              canAdmin: function() {
                return Promise.resolve(true);
              }
            });
          }
        }
      });

      return roomService
        .createRoomForGitHubUri(fixture.user1, 'gitterTest')
        .then(function (result) {
          assert.equal(result.troupe.uri, 'gitterTest');
          assert.equal(result.troupe.userCount, 0);
        })
        .finally(function () {
          return persistence.Troupe.remove({ uri: 'gitterTest' }).exec();
        });
    });

    it('should be idempotent', function() {
      var groupId = new ObjectID();
      var roomService = testRequire.withProxies("./services/room-service", {
        'gitter-web-groups/lib/group-service': {
          migration: {
            ensureGroupForGitHubRoomCreation: function(pUser, options) {
              assert.strictEqual(pUser, fixture.user1);
              assert.deepEqual(options, {
                uri: "gitterTest"
              });
              return Promise.resolve({ _id: groupId });
            }
          }
        },
        'gitter-web-permissions/lib/github-policy-factory': {
          createPolicyForGithubObject: function(user, uri, githubType, security) {
            assert.strictEqual(user.username, fixture.user1.username);
            assert.strictEqual(uri, 'gitterTest');
            assert.strictEqual(githubType, 'ORG');
            assert.strictEqual(security, null);
            return Promise.resolve({
              canAdmin: function() {
                return Promise.resolve(true);
              }
            });
          }
        }
      });

      return Promise.join(
        roomService.createRoomForGitHubUri(fixture.user1, 'gitterTest'),
        roomService.createRoomForGitHubUri(fixture.user1, 'gitterTest'),
        function(r1, r2) {
          assert(mongoUtils.objectIDsEqual(r1.troupe._id, r2.troupe._id));
        });
    });
  });

  describe('renames #slow', function() {
    var roomValidatorMock, roomService;
    var createPolicyForGithubObjectMock;
    var groupId;

    beforeEach(function() {
      createPolicyForGithubObjectMock = mockito.mockFunction();
      groupId = new ObjectID();

      roomValidatorMock = mockito.mockFunction();
      roomService = testRequire.withProxies('./services/room-service', {
        'gitter-web-github': {
          GitHubUriValidator: roomValidatorMock
        },
        'gitter-web-permissions/lib/github-policy-factory': {
          createPolicyForGithubObject: createPolicyForGithubObjectMock
        },
        'gitter-web-groups/lib/group-service': {
          migration: {
            ensureGroupForGitHubRoomCreation: function() {
              return Promise.resolve({ _id: groupId });
            }
          }
        },
      });
    });

    describe('rename a room if a user attempts to create a new room with an existing githubId', function() {
      var originalUrl = 'moo/cow-' + Date.now();
      var renamedUrl = 'bob/renamed-cow-' + Date.now();

      var fixture = fixtureLoader.setup({
        user1: { },
        troupeRepo: {
          uri: originalUrl,
          lcUri: originalUrl,
          githubType: 'REPO',
          githubId: true,
          users: ['user1']
        },
      });

      it('should succeed', function() {
        mockito.when(roomValidatorMock)().then(function() {
          return Promise.resolve({
            type: 'REPO',
            uri: renamedUrl,
            description: 'renamed',
            githubId: fixture.troupeRepo.githubId,
            security: 'PUBLIC'
          });
        });

        mockito.when(createPolicyForGithubObjectMock)().then(function() {
          return Promise.resolve({
            canAdmin: function() {
              return true;
            }
          });
        })

        return roomService.createRoomByUri(fixture.user1, renamedUrl, {})
          .then(function(result) {
            assert.strictEqual(result.didCreate, false);
            assert.strictEqual(result.troupe.uri, renamedUrl);
            assert.strictEqual(result.troupe.lcUri, renamedUrl);
            assert.strictEqual(result.troupe.renamedLcUris[0], originalUrl);
          });
      });
    });

    /**
     * • A room "x/y" does not exist but used to be called "a/b" on GitHub
     * • User attempts to create a new room "a/b"
     * • Should return room 'x/y'
     */
     describe('rename a room if a user attempts to create an repo room which has been renamed but does not have a room on Gitter', function() {
       var originalUrl4 = 'moo4/cow-' + Date.now();
       var renamedUrl4 = 'bob4/renamed-cow-' + Date.now();

       it('should succeed', function() {
         mockito.when(roomValidatorMock)().then(function() {
           return Promise.resolve({
             type: 'REPO',
             uri: renamedUrl4,
             description: 'renamed',
             githubId: fixture.generateGithubId(),
             security: 'PUBLIC'
           });
         });

         mockito.when(createPolicyForGithubObjectMock)().then(function() {
           return Promise.resolve({
             canAdmin: function() {
               return true;
             }
           });
         })

         return roomService.createRoomByUri(fixture.user1, originalUrl4, {})
           .then(function(result) {
             assert.strictEqual(result.didCreate, true);
             assert.strictEqual(result.troupe.uri, renamedUrl4);
             assert.strictEqual(result.troupe.lcUri, renamedUrl4);
           });
       });
    });
    /**
     * • A room "x/y" exists.
     * • User renames repo on github to "a/b"
     * • User attempts to create a new room "x/y"
     * • Should return room 'x/y' but renamed to "a/b"
     */
    it('rename a room if a user attempts to create an old room with an existing githubId', function() {
      var originalUrl2 = 'moo2/cow-' + Date.now();
      var renamedUrl2 = 'bob2/renamed-cow-' + Date.now();

      var fixture = fixtureLoader.setup({
        user1: {},
        troupeRepo2: {
          uri: renamedUrl2,
          lcUri: renamedUrl2,
          githubType: 'REPO',
          githubId: true,
          users: ['user1', 'user2']
        }
      });

      it('should succeed', function() {
        mockito.when(roomValidatorMock)().then(function() {
          return Promise.resolve({
            type: 'REPO',
            uri: renamedUrl2,
            description: 'renamed',
            githubId: fixture.troupeRepo2.githubId,
            security: 'PUBLIC'
          });
        });

        mockito.when(createPolicyForGithubObjectMock)().then(function() {
          return Promise.resolve({
            canAdmin: function() {
              return true;
            }
          });
        })

        return roomService.createRoomByUri(fixture.user1, originalUrl2, {})
          .then(function(result) {
            assert.strictEqual(result.didCreate, false);
            assert.strictEqual(result.troupe.id, fixture.troupeRepo2.id);
            assert.strictEqual(result.troupe.uri, renamedUrl2);
            assert.strictEqual(result.troupe.lcUri, renamedUrl2);
          });
      });
    });

    /**
     * • A room "x/y" exists.
     * • User renames repo on github to "a/b"
     * • User attempts to create a new room "a/b"
     * • Should return room 'x/y' but renamed to "a/b"
     */
    describe('should rename a room if a user attempts to create a new room with an old uri that does not exist', function() {
      var originalUrl3 = 'moo3/cow-' + Date.now();
      var renamedUrl3 = 'bob3/renamed-cow-' + Date.now();

      var fixture = fixtureLoader.setup({
        user1: {},
        troupe: {
          uri: originalUrl3,
          lcUri: originalUrl3,
          githubType: 'REPO',
          githubId: true,
          users: ['user1']
        }
      });

      it('should succeed', function() {
        mockito.when(roomValidatorMock)().then(function() {
          return Promise.resolve({
            type: 'REPO',
            uri: renamedUrl3,
            description: 'renamed',
            githubId: fixture.troupe.githubId,
            security: 'PUBLIC'
          });
        });

        mockito.when(createPolicyForGithubObjectMock)().then(function() {
          return Promise.resolve({
            canAdmin: function() {
              return true;
            }
          });
        })

        return roomService.createRoomByUri(fixture.user1, renamedUrl3, {})
          .then(function(result) {
            assert.strictEqual(result.didCreate, false);
            assert.strictEqual(result.troupe.id, fixture.troupe.id);
            assert.strictEqual(result.troupe.uri, renamedUrl3);
            assert.strictEqual(result.troupe.lcUri, renamedUrl3);
          });
      });

    });



  });

  describe('createRoomForGitHubUri #slow', function() {
    var roomValidatorMock, roomService;
    var createPolicyForGithubObjectMock;
    var duplicateGithubId = fixtureLoader.generateGithubId();
    var groupId;

    var fixture = fixtureLoader.setup({
      troupeOrg1: {
        githubType: 'ORG',
        users: []
      },
      troupeDup1: {
        githubType: 'REPO',
        githubId: duplicateGithubId
      },
      troupeDup2: {
        githubType: 'REPO',
        githubId: duplicateGithubId
      },
      user1: {}
    });

    beforeEach(function() {
      createPolicyForGithubObjectMock = mockito.mockFunction();
      groupId = new ObjectID();
      roomValidatorMock = mockito.mockFunction();
      roomService = testRequire.withProxies('./services/room-service', {
        'gitter-web-groups/lib/group-service': {
          migration: {
            ensureGroupForGitHubRoomCreation: function() {
              return Promise.resolve({ _id: groupId });
            }
          }
        },
        'gitter-web-github': {
          GitHubUriValidator: roomValidatorMock
        },
        'gitter-web-permissions/lib/github-policy-factory': {
          createPolicyForGithubObject: createPolicyForGithubObjectMock,
        }
      });
    });

    it('should return an new room if one does not exist', function() {

      mockito.when(createPolicyForGithubObjectMock)().then(function() {
        return Promise.resolve({
          canAdmin: function() {
            return true;
          }
        });
      })

      var orgUri = fixture.generateUri('ORG');
      var githubId = fixture.generateGithubId();
      mockito.when(roomValidatorMock)().then(function() {
        return Promise.resolve({
          type: 'ORG',
          uri: orgUri,
          githubId: githubId,
          description: 'renamed',
          security: 'PUBLIC'
        });
      });

      return roomService.createRoomForGitHubUri(fixture.user1, orgUri)
        .then(function(result) {
          assert.strictEqual(result.troupe.uri, orgUri);
          assert.strictEqual(result.troupe.githubId, githubId);
        });
    });

    it('should return an existing room if it exists', function() {
      mockito.when(createPolicyForGithubObjectMock)().then(function() {
        return Promise.resolve({
          canAdmin: function() {
            return true;
          }
        });
      })

      mockito.when(roomValidatorMock)().then(function() {
        return Promise.resolve({
          type: fixture.troupeOrg1.githubType,
          uri: fixture.troupeOrg1.uri,
          githubId: fixture.troupeOrg1.githubId,
          description: 'renamed',
          security: 'PUBLIC'
        });
      });

      return roomService.createRoomForGitHubUri(fixture.user1, fixture.troupeOrg1.uri)
        .then(function(result) {
          assert.strictEqual(result.troupe.id, fixture.troupeOrg1.id);
        });
    });

    it('should deal with room renames where a room with the new URI has been created', function() {
      mockito.when(createPolicyForGithubObjectMock)().then(function() {
        return Promise.resolve({
          canAdmin: function() {
            return true;
          }
        });
      })

      mockito.when(roomValidatorMock)().then(function() {
        // The room has been renamed
        return Promise.resolve({
          type: 'REPO',
          uri: fixture.troupeDup2.uri,
          githubId: duplicateGithubId,
          description: 'renamed',
          security: 'PUBLIC'
        });
      });

      return roomService.createRoomForGitHubUri(fixture.user1, fixture.troupeDup1.uri)
        .then(function(result) {
          assert.strictEqual(result.troupe.id, fixture.troupeDup2.id);
        });
    });

  });

  describe('findAllRoomsIdsForUserIncludingMentions', function() {
    var getRoomIdsMentioningUserMock, findRoomIdsForUserMock, roomService;

    beforeEach(function() {
      getRoomIdsMentioningUserMock = mockito.mockFunction();
      findRoomIdsForUserMock = mockito.mockFunction();
      roomService = testRequire.withProxies('./services/room-service', {
        './unread-items': {
          getRoomIdsMentioningUser: getRoomIdsMentioningUserMock
        },
        './room-membership-service': {
          findRoomIdsForUser: findRoomIdsForUserMock
        }
      });
    });

    function runWithValues(roomIdsForUser, roomIdsMentioningUser, expected, expectedNonMembers) {
      var userId = 'user1';

      mockito.when(getRoomIdsMentioningUserMock)().then(function(pUserId) {
        assert.strictEqual(pUserId, userId);
        return Promise.resolve(roomIdsMentioningUser);
      });

      mockito.when(findRoomIdsForUserMock)().then(function(pUserId) {
        assert.strictEqual(pUserId, userId);
        return Promise.resolve(roomIdsForUser);
      });

      return roomService.findAllRoomsIdsForUserIncludingMentions(userId)
        .spread(function(allTroupeIds, nonMemberTroupeIds) {
          allTroupeIds.sort();
          nonMemberTroupeIds.sort();
          expected.sort();
          expectedNonMembers.sort();
          assert.deepEqual(allTroupeIds, expected);
          assert.deepEqual(nonMemberTroupeIds, expectedNonMembers);
        });
    }

    it('should handle the trivial case of no rooms', function() {
      return runWithValues([], [], [], []);
    });

    it('should handle the non member rooms only case', function() {
      return runWithValues([], ['1'], ['1'], ['1']);
    });

    it('should handle the member rooms only case', function() {
      return runWithValues(['1'], [], ['1'], []);
    });

    it('should handle the member rooms only case with mentions', function() {
      return runWithValues(['1'], ['1'], ['1'], []);
    });

    it('should handle the mixed cases', function() {
      return runWithValues(['1','2','3'], ['2','3','4'], ['1','2','3', '4'], ['4']);
    });


  });

  describe('joinRoom', function() {
    describe('unit tests', function() {
      var roomService;
      var assertJoinRoomChecks;
      var recentRoomServiceSaveLastVisitedTroupeforUserId;
      var roomMembershipServiceAddRoomMember;
      var troupe;
      var joinRoomCheckFailed;
      var user;
      var userId;
      var troupeId;

      beforeEach(function() {
        userId = 'userId1';
        troupeId = 'troupeId1';
        user = {
          id: userId,
          _id: userId
        };
        troupe = {
          id: troupeId,
          _id: troupeId
        };

        assertJoinRoomChecks = mockito.mockFunction();
        recentRoomServiceSaveLastVisitedTroupeforUserId = mockito.mockFunction();
        roomMembershipServiceAddRoomMember = mockito.mockFunction();

        mockito.when(assertJoinRoomChecks)().then(function(pRoom, pUser) {
          assert.strictEqual(pUser, user);
          assert.strictEqual(pRoom, troupe);
          if (joinRoomCheckFailed) return Promise.reject(new StatusError());
          return Promise.resolve();
        });

        mockito.when(recentRoomServiceSaveLastVisitedTroupeforUserId)().then(function(pUserId, pRoomId, pOptions) {
          assert.strictEqual(pUserId, userId);
          assert.strictEqual(pRoomId, troupeId);
          assert.deepEqual(pOptions, { skipFayeUpdate: true });
          return Promise.resolve();
        });

        mockito.when(roomMembershipServiceAddRoomMember)().then(function(pRoomId, pUserId) {
          assert.strictEqual(pUserId, userId);
          assert.strictEqual(pRoomId, troupeId);
          return Promise.resolve();
        });

        roomService = testRequire.withProxies('./services/room-service', {
          './room-membership-service': {
            addRoomMember: roomMembershipServiceAddRoomMember
          },
          './assert-join-room-checks': assertJoinRoomChecks,
          './recent-room-service': {
            saveLastVisitedTroupeforUserId: recentRoomServiceSaveLastVisitedTroupeforUserId
          }
        });
      });

      it('should allow a user to join a room', function() {
        joinRoomCheckFailed = false;

        return roomService.joinRoom(troupe, user)
          .then(function() {
            mockito.verify(assertJoinRoomChecks, once)();
            mockito.verify(recentRoomServiceSaveLastVisitedTroupeforUserId, once)();
            mockito.verify(roomMembershipServiceAddRoomMember, once)();
          });
      });

      it('should deny a user join room there are too many people in the room', function() {
        joinRoomCheckFailed = true;

        return roomService.joinRoom(troupe, user)
          .then(function() {
            assert.ok(false, 'Expected an exception');
          })
          .catch(StatusError, function() {
            // This is what we want...
          })
          .then(function() {
            mockito.verify(assertJoinRoomChecks, once)();
          });
      });
    });

    describe('integration tests #slow', function() {
      var fixture = {};
      var roomService;
      var createPolicyForRoom;
      var access;
      var roomMembershipService;

      before(fixtureLoader(fixture, {
        troupeOrg1: {
          githubType: 'ORG',
          users: []
        },
        user1: {}
      }));

      after(function() {
        fixture.cleanup();
      });

      beforeEach(function() {
        roomMembershipService = testRequire('./services/room-membership-service');
        createPolicyForRoom = mockito.mockFunction();

        mockito.when(createPolicyForRoom)().then(function(pUser, pRoom) {
          assert.strictEqual(pUser, fixture.user1);
          assert.strictEqual(pRoom.id, fixture.troupeOrg1.id);
          return Promise.resolve({
            canJoin: function() {
              return Promise.resolve(access);
            }
          });
        });

        roomService = testRequire.withProxies('./services/room-service', {
          'gitter-web-permissions/lib/policy-factory': {
            createPolicyForRoom: createPolicyForRoom
          }
        });
      });


      it('should add a member to the room', function() {
        access = true;

        return roomService.joinRoom(fixture.troupeOrg1, fixture.user1)
          .then(function() {
            return roomMembershipService.checkRoomMembership(fixture.troupeOrg1.id, fixture.user1.id);
          })
          .then(function(isMember) {
            assert.strictEqual(isMember,true);
          });
      });

      it('should be idempotent', function() {
        access = true;

        return roomService.joinRoom(fixture.troupeOrg1, fixture.user1)
          .then(function() {
            return roomMembershipService.checkRoomMembership(fixture.troupeOrg1.id, fixture.user1.id);
          })
          .then(function(isMember) {
            assert.strictEqual(isMember,true);
            return roomService.joinRoom(fixture.troupeOrg1, fixture.user1);
          })
          .then(function() {
            return roomMembershipService.checkRoomMembership(fixture.troupeOrg1.id, fixture.user1.id);
          })
          .then(function(isMember) {
            assert.strictEqual(isMember,true);
          });
      });

    });

  });

});
