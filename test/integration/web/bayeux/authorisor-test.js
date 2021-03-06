"use strict";

var testRequire = require('../../test-require');
var assert = require('assert');
var Promise = require('bluebird');
var testGenerator = require('../../test-generator');

var mockito = require('jsmockito').JsMockito;


describe('authorisor', function() {
  describe('incoming', function() {

    // All of our fixtures
    var FIXTURES = [{
      name: 'Subscribe, socket does not exist',
      meta: {
        socketExists: false,
        clientId: 'y',
        expectedError: true
      }
    },{
      name: 'socket exists',
      meta: {
        socketExists: true,
        clientId: 'x',
        userId: '53d8a945451e506ad636c9ba'
      },
      tests: [{
        name: 'room subscription',
        meta: {
          troupeId: '53d8a7145be4af565d856e6e',
          subscription: "/api/v1/rooms/53d8a7145be4af565d856e6e"
        },
        tests: [{
          name: 'has access',
          canAccessRoom: true
        },{
          name: 'has no access',
          canAccessRoom: false,
          expectedError: true
        }]
      }, {
        name: 'forum categories subscription',
        meta: {
          forumId: '57bd75d9a8aefa74c58d9d6c',
          subscription: "/api/v1/forums/57bd75d9a8aefa74c58d9d6c/categories"
        },
        tests: [{
          name: 'has access',
          canAccessForum: true
        },{
          name: 'has no access',
          canAccessForum: false,
          expectedError: true
        }]
      }, {
        name: 'forum topics subscription',
        meta: {
          forumId: '57bd75d9a8aefa74c58d9d6c',
          subscription: "/api/v1/forums/57bd75d9a8aefa74c58d9d6c/topics"
        },
        tests: [{
          name: 'has access',
          canAccessForum: true
        },{
          name: 'has no access',
          canAccessForum: false,
          expectedError: true
        }]
      }, {
        name: 'topic replies subscription',
        meta: {
          forumId: '57bd75d9a8aefa74c58d9d6c',
          topicId: '57c6e136f388d1e978b8e7d1',
          subscription: "/api/v1/forums/57bd75d9a8aefa74c58d9d6c/topics/57c6e136f388d1e978b8e7d1/replies"
        },
        tests: [{
          name: 'has access',
          canAccessForum: true
        },{
          name: 'has no access',
          canAccessForum: false,
          expectedError: true
        }]
      }, {
        name: 'reply comments subscription',
        meta: {
          forumId: '57bd75d9a8aefa74c58d9d6c',
          topicId: '57c6e136f388d1e978b8e7d1',
          replyId: '57d7d83984cf3beb9c6e6f1a',
          subscription: "/api/v1/forums/57bd75d9a8aefa74c58d9d6c/topics/57c6e136f388d1e978b8e7d1/replies/57d7d83984cf3beb9c6e6f1a/comments"
        },
        tests: [{
          name: 'has access',
          canAccessForum: true
        },{
          name: 'has no access',
          canAccessForum: false,
          expectedError: true
        }]
      }, {
        name: 'user subscription (own userId)',
        meta: {
          subscription: "/api/v1/user/53d8a945451e506ad636c9ba"
        }
      },{
        name: 'user subscription (another userId)',
        meta: {
          subscription: "/api/v1/user/53d8aa12d795e2ab8be23550", // different
          expectedError: true // Access denied
        }
      }]
    },];

    testGenerator(FIXTURES, function(name, meta) {

      var presenceServiceMock = mockito.mock(testRequire('gitter-web-presence'));
      var restfulMock = mockito.mock(testRequire('./services/restful'));
      var createPolicyForUserIdInRoomId = mockito.mockFunction();
      var createPolicyForUserIdInForumId = mockito.mockFunction();

      mockito.when(createPolicyForUserIdInRoomId)().then(function(userId, roomId) {
        if(meta.canAccessRoom !== true && meta.canAccessRoom !== false) {
          assert(false, 'Unexpected call to canAccessRoom');
        }

        assert.equal(userId, meta.userId);
        assert.equal(roomId, meta.troupeId);

        return Promise.resolve({
          canRead: function() {
            return Promise.resolve(!!meta.canAccessRoom);
          }
        })
      });

      mockito.when(createPolicyForUserIdInForumId)().then(function(userId, forumId) {
        if(meta.canAccessForum !== true && meta.canAccessForum !== false) {
          assert(false, 'Unexpected call to canAccessForum');
        }

        assert.equal(userId, meta.userId);
        assert.equal(forumId, meta.forumId);

        return Promise.resolve({
          canRead: function() {
            return Promise.resolve(!!meta.canAccessForum);
          }
        })
      });

      var authorisor = testRequire.withProxies("./web/bayeux/authorisor", {
        'gitter-web-permissions/lib/policy-factory': {
          createPolicyForUserIdInRoomId: createPolicyForUserIdInRoomId,
          createPolicyForUserIdInForumId: createPolicyForUserIdInForumId
        },
        'gitter-web-topics/lib/topic-service': {
          findByIdForForum: function(forumId, topicId) {
            if (forumId === meta.forumId && topicId === meta.topicId) {
              return Promise.resolve(true); // not really a topic
            } else {
              return Promise.resolve(null);
            }
          }
        },
        'gitter-web-topics/lib/reply-service': {
          findByIdForForumAndTopic: function(forumId, topicId, replyId) {

            if (forumId === meta.forumId && topicId === meta.topicId && replyId === meta.replyId) {
              return Promise.resolve(true); // not really a reply
            } else {
              return Promise.resolve(null);
            }
          }
        },
        'gitter-web-presence': presenceServiceMock,
        '../../services/restful': restfulMock
      });

      it(name, function(done) {
        var message = {
          channel: '/meta/subscribe',
          clientId: meta.clientId,
          subscription: meta.subscription
        };

        mockito.when(presenceServiceMock).lookupUserIdForSocket()
          .then(function(clientId) {
            assert.equal(clientId, meta.clientId);
            if(!meta.socketExists) return Promise.resolve([null, false]);

            return Promise.resolve([meta.userId, true]);
          });

        authorisor.incoming(message, null, function(message) {
          if(meta.expectedError) {
            assert(!!message.error, "Expected an error");
            done();
          } else {
            done(message.error);
          }
        });

      });

    });
  });

});
