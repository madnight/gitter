/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'utils/never-ending-story',
  'log!infinite-scroll'
], function(NeverEndingStory, log) {
  "use strict";

  /** @const */
  var PAGE_SIZE = 15;

  /**
   * This mixin is intended for Marionette.CollectionView
   */
  return {
    initialize: function() {
      var scrollElement = this.scrollElementSelector ? /*this.el*/document.querySelector(this.scrollElementSelector) : this.el;

      var scroll = new NeverEndingStory(scrollElement, { reverse: this.reverseScrolling });
      var loading = false;
      this.listenTo(scroll, 'approaching.top', function() {
        if(loading) return;
        loading = true;
        console.log('LOADING!');
        this.loadMore(function() {
          console.log('DONE!!!!');
          loading = false;
        });
      });

      this.listenTo(this.collection, 'search:newquery', function() {
        scroll.enable();
        scroll.scrollToOrigin();
      });

      this.listenTo(this.collection, 'search:nomore', function() {
        scroll.disable();
      });


      this.scroll = scroll;
    },

    beforeClose: function() {
      this.scroll.disable();
    },

    loadMore: function(done) {
      // If the collection support pagenation, use it
      if(this.collection.fetchNext) {
        this.collection.fetchNext({
          context: this,
          done: done
        });
      }

      var fetchData = this.getFetchData && this.getFetchData.call(this) || {
        skip: this.collection.length,
        limit: PAGE_SIZE
      };

      if(!fetchData) {
        // No fetch data means nothing to fetch
        return;
      }

      var itemAdded = false;
      function onAdd() {
        itemAdded = true;
      }

      this.collection.once('add', onAdd);
      var self = this;
      this.collection.fetch({
        update: true,
        add: true,
        remove: false, // Never remove on load more
        data: fetchData,
        success: function() {
          // self.scroll.loadComplete();

          self.collection.off('add', onAdd);

          if(!itemAdded) {
            // turn off infinite scroll if there were no new messages retrieved
            self.scroll.disable();
          }

          done();

        },
        error: function() {
          done();
          // self.scroll.loadComplete();
        }
      });
    }


  };

});
