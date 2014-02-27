/* jshint unused:true, browser:true,  strict:true *//* global define:false */
define([
  'underscore',
  'utils/context',
  'log!chat-collection-view',
  'collections/chat',
  'views/widgets/avatar',
  'views/infinite-scroll-mixin',
  'components/unread-items-client',
  'marionette',
  'views/base',
  'utils/appevents',
  './chatItemView',
  'utils/rollers',
  'cocktail',
  'bootstrap_tooltip' // No ref
], function(_, context, log, chatModels, AvatarView, InfiniteScrollMixin, unreadItemsClient,
    Marionette, TroupeViews, appEvents, chatItemView, Rollers, cocktail /* tooltip*/) {
  "use strict";

  /** @const */
  var PAGE_SIZE = 15;

  /*
   * View
   */
  var ChatCollectionView = Marionette.CollectionView.extend({
    itemView: chatItemView.ChatItemView,
    reverseScrolling: true,
    itemViewOptions: function(item) {
      var options = {
        userCollection: this.userCollection,
        decorators: this.decorators
      };

      if(item && item.id) {
        var e = this.$el.find('.model-id-' + item.id)[0];
        if(e) options.el = e;
      }
      return options;
    },
    scrollElementSelector: "#content-frame",

    /* "WHAT THE F" is this nasty thing. Document your codedebt people */
    adjustTopPadding: function() {
      var size = $('#header-wrapper').height() + 15 + 'px';
      var ss = document.styleSheets[1];
      try {
        if(ss.insertRule) {
          ss.insertRule('.trpChatContainer > div:first-child { padding-top: ' + size + ' }', ss.cssRules.length);
        } else if(ss.addRule) {
          ss.addRule('.trpChatContainer > div:first-child', 'padding-top:' + size);
        }
      } catch(err) {
      }
    },

    initialize: function(options) {
      // this.hasLoaded = false;
      this.adjustTopPadding();
      var self=this;
      var resizer;
      $(window).resize(function(){
        clearTimeout(resizer);
        resizer = setTimeout(self.adjustTopPadding, 100);
      });

      var contentFrame = document.querySelector(this.scrollElementSelector);

      this.rollers = new Rollers(contentFrame);

      this.userCollection = options.userCollection;
      this.decorators     = options.decorators || [];

      this.rollers.scrollToBottom();

      /* Scroll to the bottom when the user sends a new chat */
      this.listenTo(appEvents, 'chat.send', function() {
        this.rollers.scrollToBottom();
      });

    },

    scrollToFirstUnread: function() {
      var self = this;
      var syncCount = 0;

      function findFirstUnread(callback) {
        var firstUnread = self.collection.findWhere({ unread: true });

        if(!firstUnread && syncCount > 8) {
          // stop trying to load so many messages. Have some old message instead.
          var someOldMessage = self.collection.first();
          return callback(someOldMessage);
        }

        if(!firstUnread) {
          self.loadMore();
          self.collection.once('sync', function() {
            syncCount++;
            findFirstUnread(callback);
          });
        } else {
          callback(firstUnread);
        }
      }

      findFirstUnread(function(firstUnread) {
        if(!firstUnread) return;

        var firstUnreadView = self.children.findByModel(firstUnread);
        self.rollers.scrollToElement(firstUnreadView.el);

      });
    },

    scrollToFirstUnreadBelow: function() {
      var contentFrame = document.querySelector(this.scrollElementSelector);

      var unreadItems = contentFrame.querySelectorAll('.unread');
      var viewportBottom = this.rollers.getScrollBottom() + 1;
      var firstOffscreenElement = _.sortedIndex(unreadItems, viewportBottom, function(element) {
        return element.offsetTop;
      });

      var element = unreadItems[firstOffscreenElement];
      if(element) {
        this.rollers.scrollToElement(element);
      }
    },

    scrollToBottom: function() {
      this.rollers.scrollToBottom();
    },

    isScrolledToBottom: function() {
      return this.rollers.isScrolledToBottom();
    },

    onAfterItemAdded: function() {
      if(this.collection.length === 1) {
        this.adjustTopPadding();
      }
    },

    pageUp: function() {
      var scrollFromTop = this.$el.scrollTop();
      var pageHeight = Math.floor(this.$el.height() * 0.8);
      this.$el.scrollTop(scrollFromTop - pageHeight);

      // page up doesnt trigger scroll events
      if(scrollFromTop === 0) {
        this.scroll.trigger('approaching.end');
      }
    },

    pageDown: function() {
      var scrollFromTop = this.$el.scrollTop();
      var pageHeight = Math.floor(this.$el.height() * 0.8);
      this.$el.scrollTop(scrollFromTop + pageHeight);
    },

    getFetchData: function() {
      log("Loading next message chunk.");

      var ids = this.collection.map(function(m) { return m.get('id'); });
      var lowestId = _.min(ids, function(a, b) {
        if(a < b) return -1;
        if(a > b) return 1;
        return 0;
      });

      if(lowestId === Infinity) {
        log('No messages loaded, cancelling pagenation (!!)');
        return;
      }

      return {
          beforeId: lowestId,
          limit: PAGE_SIZE
      };

    }

  });
  cocktail.mixin(ChatCollectionView, TroupeViews.SortableMarionetteView, InfiniteScrollMixin);

  return ChatCollectionView;
});
