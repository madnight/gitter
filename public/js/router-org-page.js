/*global require, console, window, document */
"use strict";

var onReady = require('./utils/onready');
var Backbone= require('backbone');
var appEvents = require('utils/appevents');
var frameUtils = require('./utils/frame-utils');
var modalRegion = require('components/modal-region');

require('utils/tracking');

onReady(function(){

  require('components/link-handler').installLinkHandler();

  //We are always within an iFrame to we can
  //change the parent url with NO FEAR!
  appEvents.on('navigation', function(url) {
    window.parent.location.assign(url);
  });

  var Router = Backbone.Router.extend({

    routes: {
      '': 'index',
      ':rommId/tags': 'onNavigateTags'
    },

    index: function(){
        modalRegion.destroy();
        //FIXME: ugly hack to refresh the server rendered page once
        //a user has added tags to a room
        //jp 3/9/15
        window.location.reload();
    },

    onNavigateTags: function(roomId){
      require.ensure(['views/app/editTagsView'], function(require) {
        var EditTagsView = require('views/app/editTagsView');
        modalRegion.show(new EditTagsView({ roomId: roomId }));
      });
    }
  });

  new Router();
  Backbone.history.start({ silent: true });
});