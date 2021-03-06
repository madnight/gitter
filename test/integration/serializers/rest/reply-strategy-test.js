"use strict";

var env = require('gitter-web-env');
var nconf = env.config;
var testRequire = require('../../test-require');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var persistence = require('gitter-web-persistence');
var assertUtils = require('../../assert-utils')
var serialize = require('gitter-web-serialization/lib/serialize');
var ReplyStrategy = testRequire('./serializers/rest/reply-strategy');
var serializeObject = require('gitter-web-serialization/lib/serialize-object');
var subscriberService = require('gitter-web-topic-notifications/lib/subscriber-service');
var ForumObject = require('gitter-web-topic-models/lib/forum-object');
var assert = require('assert');
var reactionService = require('gitter-web-topic-reactions/lib/reaction-service');

var LONG_AGO = '2014-01-01T00:00:00.000Z';

function makeHash() {
  var hash = {};
  for(var i = 0; i < arguments.length; i = i + 2) {
    hash[arguments[i]] = arguments[i + 1];
  }
  return hash;
}

describe('ReplyStrategy #slow', function() {
  var blockTimer = require('../../block-timer');
  before(blockTimer.on);
  after(blockTimer.off);

  var fixture = fixtureLoader.setup({
    user1: {},
    forum1: {},
    category1: {
      forum: 'forum1'
    },
    topic1: {
      forum: 'forum1',
      category: 'category1',
      user: 'user1',
      repliesTotal: 1
    },
    reply1: {
      forum: 'forum1',
      category: 'category1',
      user: 'user1',
      topic: 'topic1',
      sent: new Date(LONG_AGO),
      commentsTotal: 1
    },
    reply2: {
      forum: 'forum1',
      category: 'category1',
      user: 'user1',
      topic: 'topic1',
      sent: new Date(LONG_AGO)
    },
    comment1: {
      forum: 'forum1',
      category: 'category1',
      user: 'user1',
      topic: 'topic1',
      reply: 'reply1',
      sent: new Date(LONG_AGO)
    }
  });

  it('should serialize a reply without a userId', function() {
    var strategy = ReplyStrategy.standard();

    var reply = fixture.reply1;
    var user = fixture.user1;

    return serialize([reply], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, [{
          id: reply.id,
          body: {
            text: reply.text,
            html: reply.html
          },
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
          },
          commentsTotal: 1,
          reactions: {},
          sent: LONG_AGO,
          editedAt: null,
          lastChanged: LONG_AGO,
          v: 1
        }])
      });
  });

  it('should serialize a reply with a userId with reactions', function() {
    var reply = fixture.reply2;
    var user = fixture.user1;

    return reactionService.addReaction(ForumObject.createForReply(reply.forumId, reply.topicId, reply._id), user._id, 'like')
      .then(function() {
        return persistence.Reply.findById(reply._id);
      })
      .then(function(reply) {
        var strategy = ReplyStrategy.standard({ currentUserId: user._id });

        return serialize([reply], strategy);
      })
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, [{
          id: reply.id,
          body: {
            text: reply.text,
            html: reply.html
          },
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
          },
          subscribed: false,
          commentsTotal: 0,
          reactions: {
            like: 1
          },
          ownReactions: {
            like: true
          },
          sent: LONG_AGO,
          editedAt: null,
          lastChanged: LONG_AGO,
          v: 1
        }])
      });
  });

  it('should serialize a reply with a userId', function() {
    var reply = fixture.reply1;
    var user = fixture.user1;

    var strategy = ReplyStrategy.standard({ currentUserId: user._id });

    return serialize([reply], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, [{
          id: reply.id,
          body: {
            text: reply.text,
            html: reply.html
          },
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
          },
          subscribed: false,
          commentsTotal: 1,
          reactions: {},
          ownReactions: {},
          sent: LONG_AGO,
          editedAt: null,
          lastChanged: LONG_AGO,
          v: 1
        }])
      });
  });

  it('should serialize a reply without a userId', function() {
    var reply = fixture.reply1;
    var user = fixture.user1;

    var strategy = ReplyStrategy.standard();

    return serialize([reply], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, [{
          id: reply.id,
          body: {
            text: reply.text,
            html: reply.html
          },
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
          },
          commentsTotal: 1,
          reactions: {},
          sent: LONG_AGO,
          editedAt: null,
          lastChanged: LONG_AGO,
          v: 1
        }])
      });
  });

  it('should serialize a reply with nested comments with a userId', function() {
    var user = fixture.user1;
    var reply = fixture.reply1;
    var comment = fixture.comment1;

    var strategy = ReplyStrategy.nested({ currentUserId: user._id });

    return serialize([reply], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, [{
          id: reply.id,
          body: {
            text: reply.text,
            html: reply.html
          },
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
          },
          subscribed: false,
          comments: [{
            id: comment.id,
            body: {
              text: comment.text,
              html: comment.html,
            },
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
            },
            reactions: {},
            ownReactions: {},
            sent: LONG_AGO,
            editedAt: null,
            lastChanged: LONG_AGO,
            v: 1
          }],
          commentsTotal: 1,
          reactions: {},
          ownReactions: {},
          sent: LONG_AGO,
          editedAt: null,
          lastChanged: LONG_AGO,
          v: 1
        }])
      });
  });

  it('should serialize a reply with nested comments without a userId', function() {
    var user = fixture.user1;
    var reply = fixture.reply1;
    var comment = fixture.comment1;

    var strategy = ReplyStrategy.nested({ });

    return serialize([reply], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, [{
          id: reply.id,
          body: {
            text: reply.text,
            html: reply.html
          },
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
          },
          comments: [{
            id: comment.id,
            body: {
              text: comment.text,
              html: comment.html,
            },
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
            },
            reactions: {},
            sent: LONG_AGO,
            editedAt: null,
            lastChanged: LONG_AGO,
            v: 1
          }],
          commentsTotal: 1,
          reactions: {},
          sent: LONG_AGO,
          editedAt: null,
          lastChanged: LONG_AGO,
          v: 1
        }])
      });
  });

  it("should serialize a reply with lookups=['user']", function() {
    var strategy = ReplyStrategy.standard({ lookups: ['user'] });

    var reply = fixture.reply1;
    var user = fixture.user1;

    return serialize([reply], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, {
          items: [{
            id: reply.id,
            body: {
              text: reply.text,
              html: reply.html
            },
            user: fixture.user1.id,
            commentsTotal: 1,
            reactions: {},
            sent: LONG_AGO,
            editedAt: null,
            lastChanged: LONG_AGO,
            v: 1
          }],
          lookups: {
            users: makeHash(fixture.user1.id, {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
            })
          }
        })
      });
  });

  it('should tell a user when they are subscribed to a reply', function() {
    var forumObject = ForumObject.createForReply(fixture.forum1._id, fixture.topic1._id, fixture.reply1._id);
    var userId = fixture.user1._id;

    return subscriberService.addSubscriber(forumObject, userId)
      .then(function() {
        var strategy = ReplyStrategy.nested({
          currentUserId: userId
        });

        return serializeObject(fixture.reply1, strategy);
      })
      .then(function(serialized) {
        assert.strictEqual(serialized.subscribed, true);
      });
  });

});
