"use strict";

var slugify = require('gitter-web-slugify');
var Promise = require('bluebird');
var Topic = require('gitter-web-persistence').Topic;
var fixtureUtils = require('./fixture-utils');
var debug = require('debug')('gitter:tests:test-fixtures');

var topicNumberSequence = 1000000;
function generateTopicNumber() {
  return topicNumberSequence++;
}

function createTopic(fixtureName, f) {
  debug('Creating %s', fixtureName);

  var title = f.title || fixtureUtils.generateName();
  var sent = f.sent || new Date();

  var doc = {
    title: title,
    slug: f.slug || slugify(title),
    forumId: f.forum && f.forum._id,
    categoryId: f.category && f.category._id,
    userId: f.user && f.user._id,
    tags: f.tags,
    number: f.number || generateTopicNumber(),
    sticky: f.sticky,
    text: f.text,
    html: f.html,
    sent: sent,
    editedAt: f.editedAt,
    lastChanged: f.lastChanged || sent,
    lastModified: f.lastModified || sent,
    repliesTotal: f.repliesTotal,
    lang: f.lang,
    _md: f._md
  };

  debug('Creating topic %s with %j', fixtureName, doc);

  return Topic.create(doc);
}

function createExtraTopics(expected, fixture, key) {
  var obj = expected[key];
  var topic = obj.topic;
  if (!topic) return;

  if (typeof topic !== 'string') throw new Error('Please specify the topic as a string id');

  if (fixture[topic]) {
    // Already specified at the top level
    obj.topic = fixture[topic];
    return;
  }

  debug('creating extra topic %s', topic);

  return createTopic(topic, {})
    .then(function(createdTopic) {
      obj.topic = createdTopic;
      fixture[topic] = createdTopic;
    });
}

function createTopics(expected, fixture) {
  return Promise.map(Object.keys(expected), function(key) {
    if (key.match(/^topic/)) {
      var expectedTopic = expected[key];

      return createTopic(key, expectedTopic, fixture)
        .then(function(topic) {
          fixture[key] = topic;
        });
    }

    return null;
  })
  .then(function() {
    return Promise.map(Object.keys(expected), function(key) {
      if (key.match(/^(reply|comment)/)) {
        return createExtraTopics(expected, fixture, key);
      }

      return null;
    });
  });
}

module.exports = createTopics;
