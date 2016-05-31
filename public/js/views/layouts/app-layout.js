"use strict";
var Marionette = require('backbone.marionette');
var modalRegion = require('components/modal-region');
var appEvents = require('utils/appevents');

//OLD LEFT MENU
var TroupeMenu = require('views/menu/old/troupeMenu');
var context = require('utils/context');
var isMobile = require('utils/is-mobile');

//NEW LEFT MENU
var RoomMenuLayout = require('../menu/room/layout/room-menu-layout');

var CommunityCreateModel = require('../community-create/community-create-model');
var CommunityCreateView = require('../community-create/community-create-view');

var oldIsoProps = {
  menu: { el: "#menu-region", init: 'initMenuRegion' }
  //RoomMenuLayout: { el: '#room-menu-container', init: 'initNewMenuRegion' }
};

require('views/behaviors/isomorphic');

module.exports = (function () {

  /** @const */
  var BACKSPACE = 8;

  var AppIntegratedLayout = Marionette.LayoutView.extend({
    template: false,
    el: 'body',

    behaviors: function(){
      var behaviors = {
        Isomorphic: {}
      };

      if(isMobile() || !context.hasFeature('left-menu')) {
        behaviors.Isomorphic.menu = { el: "#menu-region", init: 'initMenuRegion' }
      }
      else {
        behaviors.Isomorphic.RoomMenuLayout = { el: '#room-menu-container', init: 'initNewMenuRegion' };
      }

      return behaviors;
    },

    initMenuRegion: function (optionsForRegion){
      return new TroupeMenu(optionsForRegion());
    },

    initNewMenuRegion: function (optionsForRegion){
      this.menuRegion = new RoomMenuLayout(optionsForRegion({
        bus:                     appEvents,
        roomCollection:          this.roomCollection,
        orgCollection:           this.orgCollection
      }));
      return this.menuRegion;
    },

    events: {
      "keydown": "onKeyDown",
    },

    initialize: function (options) {
      this.roomCollection = options.roomCollection;
      this.orgCollection = options.orgCollection;
      this.repoCollection = options.repoCollection;
      this.dialogRegion = modalRegion;

      this.communityCreateModel = new CommunityCreateModel();
      this.hasRenderedCommunityCreateView = false;

      //Mobile events don't seem to bind 100% of the time so lets use a native method
      var menuHotspot = document.querySelector('.menu__hotspot');
      if(menuHotspot) {
        menuHotspot.addEventListener('click', function(){
          this.fireEventToggleMobileMenu();
        }.bind(this));
      }

      this.listenTo(appEvents, 'community-create-view:toggle', this.onCommunityCreateToggle, this);
    },

    initCommunityCreateRegion: function() {
      this.communityCreateView = new CommunityCreateView({
        el: '.community-create-app-root',
        model: this.communityCreateModel,
        orgCollection: this.orgCollection,
        repoCollection: this.repoCollection
      });
      return this.communityCreateView;
    },


    onKeyDown: function(e) {
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.keyCode === BACKSPACE) {
        e.stopPropagation();
        e.preventDefault();
      }
    },

    getRoomMenuModel: function (){
      if(!this.menuRegion) { return; }
      return this.menuRegion.getModel();
    },

    fireEventToggleMobileMenu: function() {
      appEvents.trigger('menu:show');
    },

    onCommunityCreateToggle: function(active) {
      if(!this.hasRenderedCommunityCreateView) {
        var communityCreateView = this.initCommunityCreateRegion();
        communityCreateView.render();
      }
      this.communityCreateModel.set('active', active);

      this.hasRenderedCommunityCreateView = true;
    }

  });

  return AppIntegratedLayout;

})();
