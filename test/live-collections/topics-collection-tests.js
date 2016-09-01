'use strict';

var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var appEvents = require('gitter-web-appevents');
var topicService = require('gitter-web-topics/lib/topic-service');
var replyService = require('gitter-web-topics/lib/reply-service');
var commentService = require('gitter-web-topics/lib/comment-service');


require('../../server/event-listeners').install();

describe('topics-live-collection', function() {
  var fixture = fixtureLoader.setup({
    user1: {},
    forum1: {},
    category1: {
      forum: 'forum1'
    },
    topic1: {
      user: 'user1',
      forum: 'forum1',
      category: 'category1'
    },
    reply1: {
      user: 'user1',
      forum: 'forum1',
      topic: 'topic1'
    }
  });

  it('should emit a create event when creating a topic', function() {
    var topicOptions = {
      title: 'Test',
      slug: 'test'
    };

    var checkEvent = appEvents.addListener('dataChange2', {
      url: '/forums/' + fixture.forum1.id + '/topics',
      operation: 'create',
      model: topicOptions
    });

    return topicService.createTopic(fixture.user1, fixture.category1, topicOptions)
      .then(checkEvent);
  });

  it('should emit an update event when adding a reply', function() {
    var checkEvent = appEvents.addListener('dataChange2', {
      url: '/forums/' + fixture.forum1.id + '/topics',
      operation: 'update',
      model: {
        id: fixture.topic1.id,
        repliesTotal: 2
      }
    });

    return replyService.createReply(fixture.user1, fixture.topic1, {
        text: 'woo'
      })
      .then(checkEvent);
  });

  it('should emit an update event when adding a comment', function() {
    var checkEvent = appEvents.addListener('dataChange2', {
      url: '/forums/' + fixture.forum1.id + '/topics',
      operation: 'update',
      model: {
        id: fixture.topic1.id
      }
    });

    return commentService.createComment(fixture.user1, fixture.reply1, {
        text: 'fwooooo'
      })
      .then(checkEvent);
  });
});
