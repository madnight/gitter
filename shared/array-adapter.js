'use strict';

var _ = require('underscore');

module.exports = {
  get: function(model, key) {
    return model[key];
  },

  at: function(collection, index) {
    return collection[index];
  },

  indexOf: function(collection, model) {
    return _.indexOf(collection, model);
  }
};
