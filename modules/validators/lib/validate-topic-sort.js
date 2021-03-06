'use strict';

var KNOWN_SORT_KEYS = [
  '_id',
  'lastChanged',
  'repliesTotal',
  'reactionCounts.like',
];

function validateTopicSort(sort) {
  var keys = Object.keys(sort);

  if (keys.length === 0) return false;

  return keys.every(function(key) {
    var value = sort[key];
    return KNOWN_SORT_KEYS.indexOf(key) !== -1 && (value === 1 || value === -1);
  });
}

module.exports = validateTopicSort;
