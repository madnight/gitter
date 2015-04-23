"use strict";
var $ = require('jquery');
var context = require('utils/context');
var apiClient = require('components/apiClient');
var Marionette = require('marionette');
var Backbone = require('backbone');
var autolink = require('autolink');
var notifications = require('components/notifications');
var Dropdown = require('views/controls/dropdown');
var appEvents = require('utils/appevents');
require('bootstrap_tooltip');

module.exports = (function() {


  function generateTooltip(troupe) {

    if (troupe.get('security') === 'PUBLIC') return 'Anyone can join';

    var tooltip;
    switch(troupe.get('githubType')) {
      case 'REPO':
        tooltip = 'All repo collaborators can join';
        break;
      case 'ORG':
        tooltip = 'All org members can join';
        break;
      case 'REPO_CHANNEL':
        var repoName = troupe.get('uri').split('/')[1];
        var repoRealm = troupe.get('security') === 'PRIVATE' ? 'Only invited users' : 'Anyone in ' + repoName;
        tooltip = repoRealm + ' can join';
        break;
      case 'ORG_CHANNEL':
        var orgName = troupe.get('uri').split('/')[0];
        var orgRealm = troupe.get('security') === 'PRIVATE' ? 'Only invited users' : 'Anyone in ' + orgName;
        tooltip = orgRealm + ' can join';
        break;
      case 'USER_CHANNEL':
        tooltip = 'Only invited users can join';
        break;
      default:
        tooltip = troupe.get('oneToOne') ? 'This chat is just between you two' : 'Only invited users can join';
    }

    return tooltip;
  }

  return Marionette.ItemView.extend({

    modelEvents: {
      change: 'redisplay'
    },

    ui: {
      cog: '.js-chat-settings',
      dropdownMenu: '#cog-dropdown',
      topic: '.js-chat-topic',
      name: '.js-chat-name',
      favourite: '.js-favourite-button'
    },

    events: {
      'click @ui.cog': 'showDropdown',
      'click #leave-room': 'leaveRoom',
      'click @ui.favourite': 'toggleFavourite',
      'dblclick @ui.topic': 'showInput',
      'keydown textarea': 'detectKeys',
    },

    initialize: function() {
      this.bindUIElements();
      this.showActivity = true;
      if(context.isLoggedIn()) {
        this.dropdown = new Dropdown({
          allowClickPropagation: true,
          collection: new Backbone.Collection(this.createMenu()),
          targetElement: this.ui.cog[0],
          placement: 'right'
        });

        this.listenTo(this.dropdown, 'selected', function(e) {
          var href = e.get('href');
          if(href === '#leave') {
            this.leaveRoom();
          } else if(href === '#notifications') {
            this.requestBrowserNotificationsPermission();
          }
        });
      } else {
        this.ui.favourite.css({ visibility: 'hidden' });
      }

      $('.js-chat-name').attr('title', generateTooltip(context.troupe()));
      $('.js-chat-name').tooltip({placement: 'right'});

      this.redisplay();
    },

    showDropdown: function() {
      this.dropdown.show();
    },

    createMenu: function() {
        var menuItems = [
          { title: 'Add people to this room', href: '#add' }
        ];

        var c = context();
        var url = this.model.get('url');

        menuItems.push({ title: 'Share this chat room', href: '#share' });
        menuItems.push({ divider: true });
        menuItems.push({ title: 'Notifications', href: '#notifications' });

        if(c.permissions && c.permissions.admin) {
          if(c.isNativeDesktopApp) {
            menuItems.push({ title: 'Integrations', href: context.env('basePath') + url + '#integrations', target: '_blank', dataset: { disableRouting: 1 } });
          } else {
            menuItems.push({ title: 'Integrations', href: '#integrations' });
          }
        }

        menuItems.push({ divider: true });

        menuItems.push({ title: 'Archives', href: 'archives/all', target: '_blank'});

        var githubType = this.model.get('githubType');
        if(githubType === 'REPO' || githubType === 'ORG') {
          menuItems.push({ title: 'Open in GitHub', href: 'https://www.github.com' + url, target: '_blank' });
        }

        menuItems.push({ title: 'Leave this room', href: '#leave' });

        return menuItems;
      },

    leaveRoom: function() {
      if(!context.isLoggedIn()) return;

      apiClient.room.delete('/users/' + context.getUserId(), { })
        .then(function() {
          appEvents.trigger('navigation', context.getUser().url, 'home', ''); // TODO: figure out a title
        });
    },

    toggleFavourite: function() {
      if(!context.isLoggedIn()) return;

      this.ui.favourite.toggleClass('favourite');
      var isFavourite = this.ui.favourite.hasClass('favourite');

      apiClient.userRoom.put('', { favourite: isFavourite });

    },

    saveTopic: function() {
      var topic = this.$el.find('textarea').val();
      context.troupe().set('topic', topic);

      apiClient.room.put('', { topic: topic });

      // TODO: once saved topic recalculate the header size
      this.editingTopic = false;
    },

    cancelEditTopic: function() {
      this.editingTopic = false;
      this.redisplay();
    },

    detectKeys: function(e) {
      this.detectReturn(e);
      this.detectEscape(e);
    },

    detectReturn: function(e) {
      if(e.keyCode === 13 && (!e.ctrlKey && !e.shiftKey)) {
        // found submit
        this.saveTopic();
        e.stopPropagation();
        e.preventDefault();
      }
    },

    detectEscape: function(e) {
      if (e.keyCode === 27) {
        // found escape, cancel edit
        this.cancelEditTopic();
      }
    },

    showInput: function() {
      if (!context().permissions.admin) return;
      if (this.editingTopic === true) return;
      this.editingTopic = true;

      var topicInputText = this.$el.find('.js-chat-topic');
      var unsafeText = topicInputText.text();

      this.oldTopic = unsafeText;

      // create inputview
      topicInputText.html("<textarea class='topic-input'></textarea>");

      var textarea = topicInputText.find('textarea').val(unsafeText);

      setTimeout(function() {
        textarea.select();
      }, 10);

    },

    requestBrowserNotificationsPermission: function() {
      if(context().desktopNotifications) {
        notifications.enable();
      }
    },

    redisplay: function() {
      var model = this.model;
      //this.ui.name.text(model.get('name'));
      this.ui.topic.text(model.get('topic'));
      autolink(this.ui.topic[0]);
      this.ui.favourite.toggleClass('favourite', !!model.get('favourite'));
    },


  });


})();

