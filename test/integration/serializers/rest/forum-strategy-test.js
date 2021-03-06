"use strict";

var env = require('gitter-web-env');
var nconf = env.config;
var testRequire = require('../../test-require');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var assertUtils = require('../../assert-utils')
var serialize = require('gitter-web-serialization/lib/serialize');
var serializeObject = require('gitter-web-serialization/lib/serialize-object');
var ForumStrategy = testRequire('./serializers/rest/forum-strategy');
var subscriberService = require('gitter-web-topic-notifications/lib/subscriber-service');
var ForumObject = require('gitter-web-topic-models/lib/forum-object');
var assert = require('assert');
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');

var LONG_AGO = '2014-01-01T00:00:00.000Z';

describe('ForumStrategy #slow', function() {
  var blockTimer = require('../../block-timer');
  before(blockTimer.on);
  after(blockTimer.off);

  var fixture = fixtureLoader.setup({
    user1: {
      accessToken: 'web-internal'
    },
    user2: {},
    forum1: {
      securityDescriptor: {
        extraAdmins: ['user1']
      }
    },
    category1: {
      forum: 'forum1',
      adminOnly: true
    },
    category2: {
      forum: 'forum1',
      order: 2
    },
    category3: {
      forum: 'forum1',
      order: 1
    },
    topic1: {
      user: 'user1',
      forum: 'forum1',
      category: 'category1',
      sent: new Date(LONG_AGO)
    }
  });

  it('should serialize a forum without a userId', function() {
    var strategy = ForumStrategy.nested();

    var user = fixture.user1;
    var forum = fixture.forum1;
    var category1 = fixture.category1;
    var category2 = fixture.category2;
    var category3 = fixture.category3;
    var topic = fixture.topic1;

    return serialize([forum], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, [{
          id: forum.id,
          name: forum.name,
          uri: forum.uri,
          tags: [],
          categories: [{
            id: category3.id,
            name: category3.name,
            slug: category3.slug,
            adminOnly: false,
            v: 1
          }, {
            id: category2.id,
            name: category2.name,
            slug: category2.slug,
            adminOnly: false,
            v: 1
          }, {
            id: category1.id,
            name: category1.name,
            slug: category1.slug,
            adminOnly: true,
            v: 1
          }],
          topics: [{
            id: topic.id,
            title: topic.title,
            slug: topic.slug,
            body: {
              text: topic.text,
              html: topic.html,
            },
            sticky: topic.sticky,
            tags: [],
            category: {
              id: category1.id,
              name: category1.name,
              slug: category1.slug,
              adminOnly: true,
              v: 1
            },
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
            },
            repliesTotal: 0,
            replyingUsers: [],
            reactions: {},
            sent: LONG_AGO,
            editedAt: null,
            lastChanged: LONG_AGO,
            v: 1
          }]
        }])
      });
  });
  it('should serialize a forum with a userId', function() {

    var user = fixture.user1;
    var forum = fixture.forum1;
    var category1 = fixture.category1;
    var category2 = fixture.category2;
    var category3 = fixture.category3;
    var topic = fixture.topic1;

    var strategy = ForumStrategy.nested({ currentUserId: user._id });

    return serialize([forum], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, [{
          id: forum.id,
          name: forum.name,
          uri: forum.uri,
          tags: [],
          categories: [{
            id: category3.id,
            name: category3.name,
            slug: category3.slug,
            adminOnly: false,
            v: 1
          }, {
            id: category2.id,
            name: category2.name,
            slug: category2.slug,
            adminOnly: false,
            v: 1
          }, {
            id: category1.id,
            name: category1.name,
            slug: category1.slug,
            adminOnly: true,
            v: 1
          }],
          topics: [{
            id: topic.id,
            title: topic.title,
            slug: topic.slug,
            body: {
              text: topic.text,
              html: topic.html,
            },
            sticky: topic.sticky,
            tags: [],
            category: {
              id: category1.id,
              name: category1.name,
              slug: category1.slug,
              adminOnly: true,
              v: 1
            },
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
            },
            subscribed: false,
            repliesTotal: 0,
            replyingUsers: [],
            reactions: {},
            ownReactions: {},
            sent: LONG_AGO,
            editedAt: null,
            lastChanged: LONG_AGO,
            v: 1
          }],
          subscribed: false,
          permissions: {
            admin: true
          }
        }])
      });
  });

  it('should tell a user when they are subscribed to a forum', function() {
    var forumObject = ForumObject.createForForum(fixture.forum1._id);
    var userId = fixture.user1._id;

    return subscriberService.addSubscriber(forumObject, userId)
      .then(function() {
        var strategy = ForumStrategy.nested({
          currentUserId: userId
        });

        return serializeObject(fixture.forum1, strategy);
      })
      .then(function(serialized) {
        assert.strictEqual(serialized.subscribed, true);
      })
  });

  it('should tell a user when they are subscribed to a topic within a forum', function() {
    var forumObject = ForumObject.createForTopic(fixture.forum1._id, fixture.topic1._id);
    var userId = fixture.user1._id;

    return subscriberService.addSubscriber(forumObject, userId)
      .then(function() {
        var strategy = ForumStrategy.nested({
          currentUserId: userId
        });

        return serializeObject(fixture.forum1, strategy);
      })
      .then(function(serialized) {
        assert.strictEqual(serialized.topics[0].subscribed, true);
      })
  });

  it('should tell a user when they are an admin of the forum', function() {
    var strategy = ForumStrategy.permissions({
      // this one sends the whole user
      currentUser: fixture.user1
    });

    return serializeObject(fixture.forum1, strategy)
      .then(function(serialized) {
        assert.strictEqual(serialized.permissions.admin, true);
      });
  });

  it('should tell a user when they are NOT an admin of the forum', function() {
    var strategy = ForumStrategy.permissions({
      // this one sends the user id
      currentUserId: fixture.user2._id
    });

    return serializeObject(fixture.forum1, strategy)
      .then(function(serialized) {
        assert.strictEqual(serialized.permissions.admin, false);
      });
  });

  describe('getCurrentUserFromOptions', function() {
    var getCurrentUserFromOptions = ForumStrategy.testOnly.getCurrentUserFromOptions;

    it('should return currentUser if present', function() {
      assert.strictEqual(getCurrentUserFromOptions({ currentUser: fixture.user1}), fixture.user1);
    });

    it('should return undefined if currentUser is not present', function() {
      assert.strictEqual(getCurrentUserFromOptions(), undefined);
    });
  });

  describe('getCurrentUserIdFromOptions', function() {
    var getCurrentUserIdFromOptions = ForumStrategy.testOnly.getCurrentUserIdFromOptions;
    it('should return currentUserId if present', function() {
      var id = getCurrentUserIdFromOptions({ currentUserId: fixture.user1._id});
      assert(mongoUtils.objectIDsEqual(id, fixture.user1._id));
    });

    it("should return currentUser's id if currentUser is present", function() {
      var id = getCurrentUserIdFromOptions({ currentUser: fixture.user1});
      assert(mongoUtils.objectIDsEqual(id, fixture.user1._id));
    });

    it('should return undefined if neither are present', function() {
      assert.strictEqual(getCurrentUserIdFromOptions(), undefined);
    });
  });

});
