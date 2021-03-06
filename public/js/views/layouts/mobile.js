"use strict";

var context = require('../../utils/context');
var Marionette = require('backbone.marionette');
var $ = require('jquery');
var modalRegion = require('../../components/modal-region');
var ChatContainerView = require('../chat/chatContainerView');
var TroupeMenu = require('../menu/old/troupeMenu');

//var RoomMenuLayout    = require('../menu/room/layout/room-menu-layout');
//var appEvents         = require('../../utils/appevents');

/* Decorators */
var emojiDecorator = require('../chat/decorators/emojiDecorator');
var mobileDecorator = require('../chat/decorators/mobileDecorator');
var ChatInputView = require('../chat/chatInputView');
var JoinRoomView = require('../chat/join-room-view');

require('../behaviors/isomorphic');


module.exports = Marionette.LayoutView.extend({
  template: false,
  el: 'body',
  dialogRegion: modalRegion,
  behaviors: {
    Isomorphic: {
      chat: { el: '#content-wrapper', init: 'initChatRegion' },
      input: { el: '#chat-input', init: 'initInputRegion' },
      menu: { el: '#menu-region', init: 'initMenuRegion' },
      //Left Menu
      //roomMenu: { el: '#room-menu-container', init: 'initMenuRegion' }
    }
  },

  ui: {
    mainPage: '#mainPage',
    showTroupesButton: '#showTroupesButton',
    scroll: '#content-frame'
  },

  events: {
    'click @ui.mainPage': 'hideTroupes',
    'click @ui.showTroupesButton': 'showHideTroupes'
  },

  modelEvents: {
    'change:roomMember': '_roomMemberChanged'
  },

  _roomMemberChanged: function() {
    var inputRegion = this.regionManager.get('input');

    if (this.model.get('roomMember')) {
      inputRegion.show(new ChatInputView({
        model: context.troupe(),
        collection: this.options.chatCollection
      }));
    } else {
      if (!this.model.get('aboutToLeave')) {
        inputRegion.show(new JoinRoomView({ }));
      }
    }

  },


  initialize: function(options) {
    this.chatCollection = options.chatCollection;
    this.dialogRegion = modalRegion;
    this.roomCollection = options.roomCollection;
    this.orgCollection = options.orgCollection;
    this.groupsCollection = options.groupsCollection;
  },

  onRender: function() {
    this.ui.showTroupesButton.toggle(!this.options.hideMenu);
  },

  initChatRegion: function(optionsForRegion) {
    var chatCollectionView = new ChatContainerView(optionsForRegion({
      collection: this.options.chatCollection,
      decorators: [emojiDecorator, mobileDecorator],
      monitorScrollPane: this.ui.scroll // Monitor the scroll region for unread items
    }));

    return chatCollectionView;
  },

  initMenuRegion: function(optionsForRegion) {
    return new TroupeMenu(optionsForRegion());
    /*
    return new RoomMenuLayout(optionsForRegion({
      bus: appEvents,
      roomCollection: this.roomCollection
    }));
    */
  },

  initInputRegion: function(optionsForRegion) {
    //return new ChatInputView(optionsForRegion({
    //  compactView: true,
    //  model: context.troupe(),
    //  collection: this.options.chatCollection,
    //}));
    if (this.model.get('roomMember')) {
      return new ChatInputView(optionsForRegion({
        model: context.troupe(),
        collection: this.options.chatCollection
      }, {rerender: true}));
    } else {
      return new JoinRoomView(optionsForRegion({}, {rerender: true}));
    }

  },

  hideTroupes: function() {
    this.makeAppFullScreen();
    //TODO Remove jp 24-11-15
    this.ui.mainPage.removeClass('partiallyOffScreen');
  },

  makeAppFullScreen: function() {
    $('html, body').scrollTop($(document).height());
  },

  showHideTroupes: function(e) {
    //TODO Remove jp 24-11-15
    this.makeAppFullScreen();
    this.ui.mainPage.toggleClass('partiallyOffScreen');
    e.stopPropagation();
  },

});
