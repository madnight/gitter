"use strict";

var assert = require('assert');
var topicsStore = require('../../../../server/stores/topics-store');
var topics = require('../../../mocks/mock-data/topics');
var navConstants = require('../../../../shared/constants/navigation');
var forumFilterConstants = require('../../../../shared/constants/forum-filters');
var forumSortConstants = require('../../../../shared/constants/forum-sorts');

describe('topicsStore', () => {

  it('should return an object with data', () => {
    assert(topicsStore(topics).data);
  });

  it('should return an object with getTopics', () => {
    assert(topicsStore(topics).getTopics);
  });

  it('should get a model by id', () => {
    assert.deepEqual(topicsStore(topics).getById('1'), topics[0]);
  });

  it('should filter by category if one is passed', () => {
    var result = topicsStore(topics, 'test-1');
    assert.equal(result.data.length, 1);
  });

  it('should not filter by category if the default category is passed', () => {
    var result = topicsStore(topics, navConstants.DEFAULT_CATEGORY_NAME);
    assert.equal(result.data.length, topics.length);
  });

  it('should filter by tag', () => {
    var result = topicsStore(topics, navConstants.DEFAULT_CATEGORY_NAME, '2');
    assert.equal(result.data.length, 2);
  });

  it('should filter by my-topics', () => {
    var result = topicsStore(
      topics,
      undefined,
      undefined,
      forumFilterConstants.FILTER_BY_TOPIC,
      forumSortConstants.MOST_RECENT_SORT,
      { username: 'cutandpastey' }
    );
    assert.equal(result.data.length, 2);

  });

});
