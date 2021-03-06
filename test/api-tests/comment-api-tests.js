
'use strict';

process.env.DISABLE_API_LISTEN = '1';

var Promise = require('bluebird');
var assert = require('assert');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');

describe('comment-api', function() {
  var app, request;

  before(function() {
    request = require("supertest-as-promised")(Promise);
    app = require('../../server/api');
  });

  var fixture = fixtureLoader.setup({
    user1: {
      accessToken: 'web-internal'
    },
    forum1: {
      securityDescriptor: {
        extraAdmins: ['user1']
      }
    },
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
    },
    reply2: {
      user: 'user1',
      forum: 'forum1',
      topic: 'topic1'
    },
    comment1: {
      user: 'user1',
      forum: 'forum1',
      topic: 'topic1',
      reply: 'reply1'
    },
    comment2: {
      user: 'user1',
      forum: 'forum1',
      topic: 'topic1',
      reply: 'reply2'
    },
  });

  it('GET /v1/forums/:forumId/topics/:topicId/replies/:replyId/comments', function() {
    return request(app)
      .get('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/comments')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var comments = result.body;

        var comment = comments.find(function(c) {
          return c.id === fixture.comment1.id;
        });
        assert.strictEqual(comment.id, fixture.comment1.id);
      });
  });

  it('GET /v1/forums/:forumId/topics/:topicId/replies/:replyId/comments/:commentId', function() {
    return request(app)
      .get('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/comments/' + fixture.comment1.id)
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var comment = result.body;
        assert.strictEqual(comment.id, fixture.comment1.id);
      });
  });

  it('PATCH /v1/forums/:forumId/topics/:topicId/replies/:replyId/comments/:commentId', function() {
    var update = {
      text: '**hello**',
    };
    return request(app)
      .patch('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/comments/' + fixture.comment1.id)
      .send(update)
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var comment = result.body;
        assert.strictEqual(comment.body.text, update.text);
        assert.strictEqual(comment.body.html, '<strong>hello</strong>');
      });
  });

  it('POST /v1/forums/:forumId/topics/:topicId/replies/:replyId/comments', function() {
    return request(app)
      .post('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/comments')
      .send({
        text: 'I am a comment.'
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var comment = result.body;
        assert.strictEqual(comment.body.text, 'I am a comment.');
      });
  });

  it('DELETE /v1/forums/:forumId/topics/:topicId/replies/:replyId/comments/:commentId', function() {
    var comment = fixture.comment2;
    return request(app)
      .del('/v1/forums/' + comment.forumId + '/topics/' + comment.topicId + '/replies/' + comment.replyId + '/comments/' + comment._id)
      .set('x-access-token', fixture.user1.accessToken)
      .expect(204);
  });

  it('GET /v1/forums/:forumId/topics/:topicId/replies/:replyId/comments/:commentId/reactions', function() {
    return request(app)
      .get('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/comments/' + fixture.comment1.id + '/reactions')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var body = result.body;
        assert.deepEqual(body, {});
      });
  });

  it('POST /v1/forums/:forumId/topics/:topicId/replies/:replyId/comments/:commentId/reactions', function() {
    return request(app)
      .post('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/comments/' + fixture.comment1.id + '/reactions')
      .send({
        reaction: 'like'
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var body = result.body;
        assert.deepEqual(body, {
          like: 1
        });
      });
  });

  it('DELETE /v1/forums/:forumId/topics/:topicId/replies/:replyId/comments/:commentId/reactions/like', function() {
    return request(app)
      .del('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/comments/' + fixture.comment1.id + '/reactions/like')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var body = result.body;
        assert.deepEqual(body, { });
      });
  });
});
