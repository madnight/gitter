'use strict';

var _                      = require('underscore');
var getRoomAvatar          = require('utils/get-room-avatar');
var BaseCollectionView     = require('../base-collection/base-collection-view');
var BaseCollectionItemView = require('../base-collection/base-collection-item-view');
var roomNameShortener      = require('../../../../utils/room-menu-name-shortener');

var proto = BaseCollectionView.prototype;

var ItemView = BaseCollectionItemView.extend({
  serializeData: function() {
    var data = this.model.toJSON();
    var avatarURL = (this.roomMenuModel.get('state') === 'search') ? null : getRoomAvatar(data.name || data.uri  || ' ');
    data.name = roomNameShortener(data.name || data.uri);
    return _.extend({}, data, {
      avatarUrl: avatarURL,
    });
  },
});

module.exports =  BaseCollectionView.extend({
  childView:          ItemView,
  className:          'tertiary-collection',

  initialize: function(attrs) {
    this.roomMenuModel  = attrs.roomMenuModel;
    this.roomCollection = attrs.roomCollection;
    this.listenTo(this.roomMenuModel, 'change:searchTerm', this.onSearchUpdate, this);
    this.listenTo(this.collection, 'filter-complete', this.render, this);
  },

  onSearchUpdate: function() {
    if (this.roomMenuModel.get('state') !== 'search') { return; }

    this.$el.toggleClass('active', !this.roomMenuModel.get('searchTerm'));
  },

  onDestroy: function() {
    this.stopListening();
  },

  onItemClicked: function() {
    switch (this.roomMenuModel.get('state')) {
      case 'all':
        return this.onOrgItemClicked.apply(this, arguments);
      case 'search':
        return this.onSearchItemClicked.apply(this, arguments);
      default:
        return proto.onItemClicked.apply(this, arguments);
    }
  },

  onOrgItemClicked: function(view) {
    var existingRoom = this.roomCollection.findWhere({ name: view.model.get('name') });
    if (!existingRoom) {
      window.location.hash = '#confirm/' + view.model.get('name'); return;
    }

    proto.onItemClicked.apply(this, arguments);
  },

  onSearchItemClicked: function (view){
    this.roomMenuModel.set('searchTerm', view.model.get('name'));
  },

});
