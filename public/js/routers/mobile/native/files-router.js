/*jshint strict:true, undef:true, unused:strict, browser:true *//* global require:false */
require([
  'jquery',
  'marionette',
  'underscore',
  'backbone',
  'utils/context',
  'routers/mobile/mobile-router',
  'views/base',
  'views/file/fileView',
  'views/file/fileDetailView',
  'collections/files',
  'views/file/mobileFilePreview',
  'components/unread-items-client',
  'components/eyeballs',              // No ref
  'template/helpers/all',             // No ref
  'components/native-context'         // No ref
], function($, Marionette, _, Backbone, context, MobileRouter, TroupeViews, FileView, FileDetailView, fileModels, MobileFilePreview, unreadItemsClient) {
  /*jslint browser: true, unused: true */
  "use strict";

  // TODO: normalise this
  var troupeId = window.location.hash.substring(1);
  if(troupeId) {
    window.location.hash = '';
  } else {
    troupeId = window.localStorage.lastTroupeId;
  }
  if(troupeId) {
    context.setTroupeId(troupeId);
    window.localStorage.lastTroupeId = troupeId;
  }

  var troupe = context.troupe();
  troupe.on('change:name', function() {
    document.title = troupe.get('name');
  });

  var AppRouter = MobileRouter.extend({
    routes: {
      'file/:id':     'showFile',
      'preview/:id':  'previewFile',
      '*actions':     'defaultAction'
    },

    initialize: function() {
      this.constructor.__super__.initialize.apply(this);
      this.fileCollection = new fileModels.FileCollection();
      this.fileCollection.listen();
    },

    defaultAction: function(/*actions*/){
      this.show('primary', new FileView({ collection: this.fileCollection }));
    },

    showFile: function(id) {
      var model = this.fileCollection.get(id);
      this.show('primary', new FileDetailView({ model: model }));
    },

    previewFile: function(id) {
      this.show('primary', new MobileFilePreview({ model: this.fileCollection.get(id) }));
    }

  });

  var troupeApp = new AppRouter();

  window.troupeApp = troupeApp;
  Backbone.history.start();

  return troupeApp;
});

