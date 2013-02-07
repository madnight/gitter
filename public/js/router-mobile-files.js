/*jshint unused:true browser:true*/
require([
  'jquery',
  'underscore',
  'backbone',
  './base-router',
  'views/base',
  'views/file/fileView',
  'views/file/fileDetailView',
  'collections/files',
  'views/file/mobileFilePreview'
], function($, _, Backbone, BaseRouter, TroupeViews, FileView, FileDetailView, fileModels, MobileFilePreview) {
  "use strict";

  var AppRouter = BaseRouter.extend({
    routes: {
      'file/:id':     'showFile',
      'preview/:id':  'previewFile',
      '*actions':     'defaultAction'
    },

    initialize: function() {
      this.fileCollection = new fileModels.FileCollection();
      //this.fileCollection.fetch();
      this.fileCollection.reset(window.troupePreloads['files']);
      this.fileCollection.listen();
    },

    defaultAction: function(/*actions*/){
      var fileView = new FileView({ collection: this.fileCollection });
      this.showView("#primary-view", fileView);
    },

    showFile: function(id) {
      var model = this.fileCollection.get(id);
      var fileDetailView = new FileDetailView({ model: model });
      this.showView("#primary-view", fileDetailView);
    },

    previewFile: function(id) {
      this.showView("#primary-view", new MobileFilePreview({ model: this.fileCollection.get(id) }));
    }

  });

  var troupeApp = new AppRouter();

  // THESE TWO LINES WILL NOT REMAIN HERE FOREVER
  //$('.dp-tooltip').tooltip();
  //$('.chat-bubble').tooltip();

  window.troupeApp = troupeApp;
  Backbone.history.start();

  // Asynchronously load tracker
  require([
    'utils/tracking'
  ], function(tracking) {
    // No need to do anything here
  });

  return troupeApp;
});
