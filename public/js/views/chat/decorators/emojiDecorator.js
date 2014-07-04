/* jshint unused:true, browser:true,  strict:true */
/* global define:false */
define(['utils/emoji'], function(emoji) {

  "use strict";

  var emojify = emoji.emojify;

  var decorator = {
    decorate: function(chatItemView) {
      emojify.run(chatItemView.$el.find('.js-chat-item-text')[0]);
    }
  };

  return decorator;

});
