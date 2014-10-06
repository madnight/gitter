
define([
  'jquery',
  'marionette',
  'utils/context',
  'utils/social',
  'views/base',
  'utils/cdn',
  'hbs!./tmpl/share',
  'zeroclipboard'
], function($, Marionette, context, social, TroupeViews, cdn, template, ZeroClipboard) {
  "use strict";

  ZeroClipboard.config({ swfPath: cdn('repo/zeroclipboard/ZeroClipboard.swf') });

  var View = Marionette.ItemView.extend({
    template: template,
    className: 'share-view',

    initialize: function() {
      this.listenTo(this, 'menuItemClicked', this.menuItemClicked);
    },

    events: {
      'click .js-badge': 'sendBadgePullRequest'
    },

    menuItemClicked: function(button) {
      switch(button) {
        case 'add':
          this.dialog.hide();
          window.location.hash = "#add";
          break;

        case 'cancel':
          this.dialog.hide();
          break;
      }
    },

    getShareUrl: function() {
      return context.env('basePath') + '/' + context.getTroupe().uri + '?utm_source=share-link&utm_medium=link&utm_campaign=share-link';
    },

    getBadgeUrl: function() {
      return context.env('badgeBaseUrl') + '/Join Chat.svg';
    },

    getBadgeMD: function() {
      var linkUrl = context.env('basePath') + '/' + context.getTroupe().uri + '?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge';
      return '[![Gitter](' + this.getBadgeUrl() + ')](' + linkUrl + ')';
    },

    detectFlash: function() {
      if (navigator.plugins && navigator.plugins["Shockwave Flash"]) {
        return true;
      }

      if(~navigator.appVersion.indexOf("MSIE") && !~navigator.userAgent.indexOf("Opera")){
        try{
          new window.ActiveXObject("ShockwaveFlash.ShockwaveFlash");
          return true;
        } catch(e) {
          // Ignore the failure
        }
      }

      return false;
    },

    serializeData: function() {
      var room = context.getTroupe();

      return {
        isRepo: room.githubType === 'REPO',
        isPublic: room.security === 'PUBLIC',
        hasFlash: this.detectFlash(),
        url: this.getShareUrl(),
        badgeUrl: this.getBadgeUrl(),
        badgeMD: this.getBadgeMD(),
        twitterUrl: social.generateTwitterShareUrl(),
        facebookUrl: social.generateFacebookShareUrl()
      };
    },

    onRender: function() {
      // ZeroClipboard instances are left hanging around
      // even after this view is closed.
      // 500pts will be awarded if you can fix this.
      var clipboard = new ZeroClipboard(this.$el.find('.js-copy'));
      clipboard.on('aftercopy', function(e) {
        $(e.target).text('Copied!');
      });
    },

    sendBadgePullRequest: function(e) {
      var btn = e.target;
      var $btn = $(btn);
      $btn.text('Sending...');
      btn.disabled = true;

      $.ajax({
        url: '/api/private/create-badge',
        contentType: "application/json",
        dataType: "json",
        type: "POST",
        data: JSON.stringify({
          uri: context.troupe().get('uri')
        }),
        global: false,
        context: this,
        timeout: 45 * 1000,
        error: function() {
          $btn.text('Failed. Try again?');
          btn.disabled = false;
        },
        success: function() {
          $btn.text('Pull Request sent!');
        }
      });
    }
  });

  var Modal = TroupeViews.Modal.extend({
    initialize: function(options) {
      options = options || {};
      options.title = options.title || "Share this chat room";

      TroupeViews.Modal.prototype.initialize.call(this, options);
      this.view = new View(options);
    },
    menuItems: [
      { action: "cancel", text: "Close", className: "trpBtnLightGrey" },
      { action: "add", text: "Add people", className: "trpBtnBlue trpBtnRight"}
    ]
  });

  return {
    View: View,
    Modal: Modal
  };

});