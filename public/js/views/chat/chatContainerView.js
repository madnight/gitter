"use strict";

var Marionette = require('backbone.marionette');
var appEvents = require('utils/appevents');
var hasScrollBars = require('utils/scrollbar-detect');
var ChatCollectionView = require('views/chat/chatCollectionView');
var context = require('utils/context');
var highlightPermalinkChats = require('utils/highlight-permalink-chats');

require('views/behaviors/isomorphic');

module.exports = Marionette.LayoutView.extend({
  behaviors: {
    Isomorphic: {}
  },

  ui: {
    primaryScroll: '.primary-scroll',
    scrollToBottom: '.js-scroll-to-bottom',
  },

  events: {
    'click @ui.scrollToBottom': appEvents.trigger.bind(appEvents, 'chatCollectionView:scrollToBottom')
  },

  regions: {
    chat: '#chat-container',
  },

  collectionEvents: {
    atBottomChanged: function(isBottom) {
      this.ui.scrollToBottom.toggleClass('scrollHelper--hidden', isBottom);
    }
  },

  initChatRegion: function(optionsForRegion) {

    var chatCollectionView = this.chatCollectionView = new ChatCollectionView(optionsForRegion('chat', {
      collection: this.collection,
      decorators: this.options.decorators
    }));

    if (context().permalinkChatId) {
      highlightPermalinkChats(chatCollectionView, context().permalinkChatId);
    }

    return chatCollectionView;
  },

  onRender: function() {
    if (hasScrollBars()) {
      this.ui.primaryScroll.addClass("scroller");
    }
  }
});
