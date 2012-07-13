// Filename: views/home/main
define([
  'jquery',
  'underscore',
  'views/base',
  'hbs!./profileModalView'
], function($, _, TroupeViews, template) {

  return TroupeViews.Base.extend({
    template: template,

    initialize: function(options) {
      _.bindAll(this, 'onFormSubmit');
    },

    events: {
      "submit form": "onFormSubmit"
    },

    onFormSubmit: function(e) {
      if(e) e.preventDefault();
    }
  });

});