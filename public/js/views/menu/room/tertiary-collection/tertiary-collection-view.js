'use strict';

var _                       = require('underscore');
var resolveRoomAvatarSrcSet = require('gitter-web-shared/avatars/resolve-room-avatar-srcset');
var BaseCollectionView      = require('../base-collection/base-collection-view');
var BaseCollectionItemView  = require('../base-collection/base-collection-item-view');
var roomNameShortener       = require('gitter-web-shared/room-name-shortener');

var proto = BaseCollectionView.prototype;

var ItemView = BaseCollectionItemView.extend({
  serializeData: function() {
    var data = this.model.toJSON();
    data.name = roomNameShortener(data.name || data.uri);
    var name = (this.roomMenuModel.get('state') === 'search') ? null : (data.name || data.uri);
    return _.extend({}, data, {
      avatarSrcset: resolveRoomAvatarSrcSet({ uri: name }, 22),
    });
  },
});

module.exports =  BaseCollectionView.extend({
  childView:          ItemView,
  className:          'tertiary-collection',

  initialize: function(attrs) {
    this.roomMenuModel  = attrs.roomMenuModel;
    this.roomCollection = attrs.roomCollection;
    this.listenTo(this.roomMenuModel, 'change:searchTerm', this.setActive, this);
    this.listenTo(this.collection, 'filter-complete', this.render, this);
    BaseCollectionView.prototype.initialize.apply(this, arguments);
  },

  setActive: function() {
    switch (this.roomMenuModel.get('state')) {
      case 'search':
        return (!this.roomMenuModel.get('searchTerm')) ?
          proto.setActive.apply(this, arguments) :
          this.el.classList.remove('active');

      default:
        return !!this.collection.length ?
          proto.setActive.apply(this, arguments) :
          this.el.classList.remove('active');
    }
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
      return this._openCreateRoomDialog(view.model);
    }

    proto.onItemClicked.apply(this, arguments);
  },

  onSearchItemClicked: function(view) {
    this.roomMenuModel.set('searchTerm', view.model.get('name'));
  },

  onDestroy: function() {
    this.stopListening();
  },

});