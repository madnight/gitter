"use strict";
var $ = require('jquery');
var _ = require('underscore');
var Backbone = require('backbone');
var Marionette = require('backbone.marionette');
var modalTemplate = require('./tmpl/modal.hbs');
var loadingTemplate = require('./tmpl/loading.hbs');
var log = require('utils/log');
var detectCompact = require('utils/detect-compact');
require('../template/helpers/all');

module.exports = (function() {


  var TroupeViews = {};

  /* Use the compact views */
  var compactView = window._troupeCompactView = detectCompact();

  // Need to do some testing on Android tablets to get this more accurate
  var isIE9 = window.navigator.userAgent.indexOf("MSIE 9.0") !== -1;
  var userAgentTabletFragment = navigator.userAgent.match(/(iPad)/);

  if (compactView) {
    $('body').addClass('trpCompactView');
  }

  window._troupeIsIE9 = isIE9;
  if (userAgentTabletFragment) window._troupeIsTablet = true;


  TroupeViews.Modal = Marionette.ItemView.extend({
    template: modalTemplate,
    className: "modal",

    events: {
      'click .button': 'onMenuItemClicked'
    },

    initialize: function(options) {
      this.options = {
        keyboard: true,
        backdrop: true,
        autoRemove: true,
        menuItems: [],
        disableClose: false,
        hideHeader: false,
        title: null,
        navigable: false
      };
      _.bindAll(this, 'hide', 'onMenuItemClicked');
      _.extend(this.options, options);

      this.view = this.options.view || this.view;
    },

    serializeData: function() {
      var menuItems = this.menuItems || this.options.menuItems;
      return {
        hideHeader: this.options.hideHeader,
        customTitle: !!this.options.title,
        title: this.options.title,
        hasMenuItems: !!menuItems.length,
        menuItems: menuItems,
        disableClose: this.options.disableClose
      };
    },

    onMenuItemClicked: function(e) {
      e.preventDefault();

      var action = $(e.target).attr('data-action');
      this.view.trigger('menuItemClicked', action);
      this.trigger('menuItemClicked', action);
    },

    onRender: function() {
      var self = this;
      this.$el.hide();

      var modalBody = this.$el.find('.modal-body');
      modalBody.append(this.view.render().el);
      this.$el.find('.close').on('click', this.hide);

      if(!compactView && !this.disableAutoFocus) {
        window.setTimeout(function() {
          try {
            var v = self.$el.find('input[type=text], input[type=url], input[type=tel], input[type=number], input[type=color], input[type=email]')[0];
            if(v) {
              v.focus();
              v.select();
            }
          } catch(e) {
          }
        }, 100);

      }
    },

    setButtonState: function(name,state) {
      var $s = this.$el.find('.modal-footer button[data-action=' + name + ']');
      if(state) {
        $s.removeAttr('disabled');
      } else {
        $s.attr('disabled', true);
      }
    },


    hideActions: function() {
      var $s = this.$el.find('.modal-footer .action');
      $s.hide();
    },

    showActions: function() {
      var $s = this.$el.find('.modal-footer .action');
      $s.show();
    },

    showPremium: function() {
      var $s = this.$el.find('.modal-footer .premium');
      $s.removeClass('hidden');
      $s.show();
    },

    hidePremium: function() {
      var $s = this.$el.find('.modal-footer .premium');
      $s.addClass('hidden');
      $s.hide();
    },

    onDestroy: function() {
      this.view.destroy();
      this.view.dialog = null;
      this.$el.find('.close').off('click');
    },

    prepare: function() {
      if(!this.rendered) {
        this.render();
        this.rendered = true;
      }
    },

    setTitle: function(title) {
      this.options.title = title;
      // cant seem to call render() twice...
      this.$el.find('.trpModalTitleHeader').text(title);
    },

    supportsModelReplacement: function() {
      return this.view &&
              this.view.supportsModelReplacement &&
              this.view.supportsModelReplacement();
    },

    replaceModel: function(model) {
      return this.view.replaceModel(model);
    },

    show: function() {
      this.view.dialog = this;

      var that = this;
      if (this.isShown) return;

      this.prepare();

      $('body').addClass('modal-open');

      this.isShown = true;
      this.$el.trigger('show');
      this.trigger('show');

      this.escape();
      this.backdrop(function () {

        if(!that.$el.parent().length) {
          that.$el.appendTo(that.$backdrop); //don't move modals dom position
        }

        that.$el.show();
        that.$el.addClass('in');
        that.$el.trigger('shown');
        that.trigger('shown');
      });
    },

    hide: function ( e ) {
      if(e) e.preventDefault();
      if(this.navigable) {
        window.location = '#';
        return;
      }
      this.hideInternal();
    },

    /* Called after navigation to destroy an navigable dialog box */
    navigationalHide: function() {
      this.hideInternal();
    },

    hideInternal: function() {
      if (!this.isShown) return;

      this.isShown = false;

      $('body').removeClass('modal-open');

      this.escape();

      this.$el
        .trigger('hide')
        .removeClass('in');

      this.trigger('hide');

      this.hideModal();
    },

    transitionTo: function(newDialog) {
      newDialog.options.backdrop = false;
      var backdrop = this.$backdrop;
      this.$backdrop = null;
      this.hide();
      backdrop.modal = newDialog;
      newDialog.show();
      newDialog.$backdrop = backdrop;

    },

    /* Modal private methods */
    hideWithTransition: function() {
      var that = this;
      var timeout = setTimeout(function () {
            that.$el.off($.support.transition.end);
            that.hideModal();
          }, 500);

      this.$el.one($.support.transition.end, function() {
        clearTimeout(timeout);
        that.hideModal();
      });
    },

    hideModal: function () {
      this.$el
        .hide()
        .trigger('hidden');

      this.trigger('hidden');
      this.backdrop();

      if(this.options.autoRemove) {
        this.destroy();
      }
    },

    backdrop: function( callback ) {
      if (this.isShown && this.options.backdrop) {

        this.$backdrop = $('<div class="modal-backdrop" />')
          .appendTo(document.body);

        if (this.options.backdrop != 'static' && !this.options.disableClose) {
          var bd = this.$backdrop;
          this.$backdrop.click(function(e) {
            if( e.target !== this ) return;

            bd.modal.hide();
          });
        }
        this.$backdrop.modal = this;
        this.$backdrop.addClass('in');

        callback();

      } else if (!this.isShown && this.$backdrop) {
        this.$backdrop.removeClass('in');

        this.removeBackdrop();

      } else if (callback) {
        callback();
      }
    },

    removeBackdrop: function() {
      this.$backdrop.remove();
      this.$backdrop = null;
    },

    escape: function () {
      if(this.options.disableClose) return;
      var that = this;
      if (this.isShown && this.options.keyboard) {
        $(document).on('keydown', keydown);
      } else if (!this.isShown) {
        $(document).off('keydown', keydown);
      }

      function keydown( e ) {
        if(e.which == 27) that.hide();
      }

    }
  });

  TroupeViews.Modal.wrapView = function(View, customisations) {
    var Modal = TroupeViews.Modal.extend(customisations);

    Modal.prototype.initialize = function(options) {
      options = options || {};
      // todo let the caller to wrapView specify their own initialize which is called instead of below
      TroupeViews.Modal.prototype.initialize.apply(this, arguments);
      this.view = new View(options);
    };

    return Modal;
  };

  TroupeViews.DelayedShowLayoutMixin = {

    show: function(regionName, view) {
      var c = view.collection, self = this;
      if (c.hasLoaded && !c.hasLoaded()) {
        // delay showing the view until the collection is loaded.
        c.once('sync reset', function() {
          self[regionName].show(view);
        });

        return;
      }

      self[regionName].show(view);
    }

  };

  /*

  Not used

  TroupeViews.ConfirmationView = Marionette.ItemView.extend({
    template: confirmationViewTemplate,

    initialize: function(options) {
      if(options.body) this.body = options.body;
      if(options.confirmationView) this.confirmationView = options.confirmationView;
    },

    serializeData: function() {
      return {
        body: this.body
      };
    },

    onRender: function() {
      if(this.confirmationView) {
        this.$el.find('#confirmation').append(this.confirmationView.render().el);
      }
    }
  });

  TroupeViews.confirm = function (message, handlers) {
    var events = handlers || {};

    events['click #cancel'] = events['click #cancel'] || function() {
      modal.hide();
    };

    var modal = new TroupeViews.Modal({
      view: new TroupeViews.ConfirmationView({
        body: message,
        buttons: [ { id: 'ok', text: 'OK'} , { id: 'cancel', text: 'Cancel' } ],
        events: events
      })
    });

    modal.show();
  };

  TroupeViews.ConfirmationModal = TroupeViews.Modal.extend({
    initialize: function(options) {
      options.view = new TroupeViews.ConfirmationView(options);
      TroupeViews.Modal.prototype.initialize.call(this, options);
    }

  });
  */

  return TroupeViews;

})();
