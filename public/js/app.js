require.config({
  paths: {
    jquery: 'libs/jquery/jquery-min',
    jquery_validate : 'libs/jquery.validate-1.9/jquery.validate.min',
    jqueryui: 'libs/jquery-ui-1.8.18/jquery-ui-1.8.18.custom.min',
    bootstrap: '../bootstrap/js/bootstrap.min',
    underscore: 'libs/underscore/underscore-1.3.1-min',
    backbone: 'libs/backbone/backbone-0.9.1',
    text: 'libs/require/text',
    mustache: 'libs/mustache/mustache',
    templates: '../templates'
  },
  priority: ['jquery']
});

require([
  'jquery',
  'underscore',
  'backbone',
  'router', 
  'router-login',
  'bootstrap',
  'jqueryui'
], function($, _, Backbone, AppRouter, AppRouterLogin, Bootstrap, jqUI) {
  
  /* From http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/ */
  Backbone.View.prototype.close = function () {
    console.log('Closing view ' + this);
    if (this.beforeClose) {
      this.beforeClose();
    }
    this.remove();
    this.unbind();
  };

  var troupeApp;
  
  $('.dp-tooltip').tooltip();
  $('.chat-bubble').tooltip();

  var AppView = Backbone.View.extend({
    el: 'body',
    
    initialize: function() {
      this.buildToolbar();
    },
    
    events: {
      "click .menu-profile": "profileMenuClicked",
      "click .menu-settings": "settingsMenuClicked",
      "click .menu-signout": "signoutMenuClicked",
      
    },
    
    buildToolbar: function() {
      if(window.troupeContext.user) {
        $(".label-displayName").text(window.troupeContext.user.displayName);
        $(".menu-security").show();
      } 
      
    },
    
    profileMenuClicked: function() {
      troupeApp.navigate("profile", {trigger: true});
    },
    
    settingsMenuClicked: function() {
      troupeApp.navigate("settings", {trigger: true});
    },
    
    signoutMenuClicked: function() {
      troupeApp.navigate("signout", {trigger: true});
    }
   

  });
  var app = new AppView();

  
  if(!window.troupeContext.user) {
    window.troupeApp = new AppRouterLogin();
    troupeApp = window.troupeApp;
    Backbone.history.start();
    
    return;
  }
  
  window.troupeApp = new AppRouter();
  troupeApp = window.troupeApp;
  
  Backbone.history.start();
});
