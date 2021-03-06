"use strict";

var getVersion = require('gitter-web-serialization/lib/get-model-version');

function ForumCategoryStrategy(/*options*/) {
  this.preload = function(/*categories*/) {
    return;
  };

  this.map = function(category) {
    var id = category.id || category._id && category._id.toHexString();

    return {
      id: id,
      name: category.name,
      slug: category.slug,
      adminOnly: category.adminOnly || false,
      v: getVersion(category)
    };
  };
}

ForumCategoryStrategy.prototype = {
  name: 'ForumCategoryStrategy',
};

module.exports = ForumCategoryStrategy;
