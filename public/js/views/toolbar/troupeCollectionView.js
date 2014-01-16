/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'utils/context',
  'marionette',
  'hbs!./tmpl/troupeListItem',
  'utils/appevents',
  'utils/momentWrapper',
  'views/base',
  'cocktail',
  'log!troupeCollView'
], function($, context, Marionette, troupeListItemTemplate, appEvents, moment,  TroupeViews, cocktail, log) {
  "use strict";

  var createRoom = context.getUser().createRoom;

  var TroupeItemView = Marionette.ItemView.extend({
    tagName: 'li',
    template: troupeListItemTemplate,
    modelEvents: {
      change: 'render',
    },
    events: {
      click: 'clicked'
    },
    serializeData: function() {
      var data = this.model.toJSON();
      data.createRoom = createRoom;
      return data;
    },
    setupSortableListGroups: function() {
      var cancelDrop = false;
      $("ul.list-favourites").sortable({
        group: 'mega-list',
        pullPlaceholder: false,
        onDrop: function (item, container, _super) {
          if (!cancelDrop) {
            if ($(container.el).attr('id') == 'list-favs') {
              // do whatever else needs to be done to add to favourites and store positions
              item.addClass("item-fav");
            }
            cancelDrop = false;
          }
          _super(item, container);
        },
        onCancel: function(item, container, _super) {      
          if ($(container.el).attr('id') == 'list-favs') {
            // do whatever else needs to be done to remove from favourites and store positions
            // TODO: at the moment if you remove all items, the UL takes up space and that makes no sense!
            item.remove();
            cancelDrop = true;
          }
        }
      });
      $("ul.list-recents").sortable({
        group: 'mega-list',
        pullPlaceholder: false,
        drop: false,
      });
    },
    clicked: function() {
      var model = this.model;
      setTimeout(function() {
        // Make things feel a bit more responsive, but not too responsive
        model.set('lastAccessTime', moment());
      }, 150);

      appEvents.trigger('navigation', model.get('url'), 'chat', model.get('name'), model.id);
    }
  });

  var CollectionView = Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'trpTroupeList',
    itemView: TroupeItemView
  });

  cocktail.mixin(CollectionView, TroupeViews.SortableMarionetteView);

  return CollectionView;

});
