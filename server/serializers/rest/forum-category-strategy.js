"use strict";

var forumCategoryService = require("gitter-web-forum-categories/lib/forum-category-service");
var collections = require('../../utils/collections');
var getVersion = require('../get-model-version');

function ForumCategoryStrategy(options) {
  this.preload = function(/*categories*/) {
    return;
  };

  this.map = function(category) {
    var id = category.id || category._id && category._id.toHexString();

    return {
      id: id,
      name: category.name,
      slug: category.slug,
    };
  };
}

ForumCategoryStrategy.prototype = {
  name: 'ForumCategoryStrategy',
};

module.exports = ForumCategoryStrategy;
