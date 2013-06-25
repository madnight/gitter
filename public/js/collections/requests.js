/*jshint unused:strict, browser:true */
define([
  'jquery',
  'underscore',
  'backbone',
  './base'
], function($, _, Backbone, TroupeCollections) {
  "use strict";

  var exports = {};

  exports.RequestModel = TroupeCollections.Model.extend({
    idAttribute: "id",

    defaults: {
    },

    initialize: function() {
    }

  });

  exports.RequestCollection = TroupeCollections.LiveCollection.extend({
    model: exports.RequestModel,
    modelName: 'request',
    nestedUrl: "requests"
  });

  return exports;

});
