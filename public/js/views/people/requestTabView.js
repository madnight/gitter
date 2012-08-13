// Filename: views/home/main
define([
  'jquery',
  'underscore',
  'backbone',
  'views/base',
  'hbs!./requestTabView',
  'collections/requests',
  './userItemView'
], function($, _, Backbone, TroupeViews, template, requestModels, UserItemView) {
  return TroupeViews.Base.extend({
    template: template,

    events: {
      //"click .clickPoint-showEmail": "onHeaderClick"
    },

    attributes: {
      //'class': 'trpMailRowContainer'
    },

    initialize: function(options) {
      var self = this;
      this.collection = new requestModels.RequestCollection();

      this.collection.listen();
      this.collection.fetch();

      this.addCleanup(function() {
        self.collection.unlisten();
      });

    },

    afterRender: function() {
      this.itemView = new TroupeViews.Collection({
          itemView: UserItemView,
          itemViewOptions: { displayMode: 'request' },
          collection: this.collection,
          el: this.$el.find(".frame-requests")});
    }

  });
});