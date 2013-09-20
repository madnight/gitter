/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'underscore',
  'utils/context',
  './base',
  '../utils/momentWrapper',
  'cocktail'
], function(_, context, TroupeCollections, moment, cocktail) {
  "use strict";

  var ChatModel = TroupeCollections.Model.extend({
    idAttribute: "id",
    parse: function(message) {
      if(message.sent) {
        message.sent = moment(message.sent, moment.defaultFormat);
      }

      if(message.editedAt) {
        message.editedAt = moment(message.editedAt, moment.defaultFormat);
      }

      // Check for the special case of messages from the current user
      if(message.unread && message.fromUser) {
        if(message.fromUser.id === context.getUserId()) {
          message.unread = false;
        }
      }

      return message;
    },

    toJSON: function() {
      var d = _.clone(this.attributes);
      var sent = this.get('sent');
      if(sent) {
        // Turn the moment sent value into a string
        d.sent = sent.format();
      }
      return d;
    }

  });

  var ChatCollection = TroupeCollections.LiveCollection.extend({
    model: ChatModel,
    modelName: 'chat',
    nestedUrl: "chatMessages",
    initialSortBy: "sent",
    sortByMethods: {
      'sent': function(chat) {
        var offset = chat.id ? 0 : 300000;

        var sent = chat.get('sent');

        if(!sent) return offset;
        return sent.valueOf() + offset;
      }
    },

    findModelForOptimisticMerge: function(newModel) {
      var optimisticModel = this.find(function(model) {
        return !model.id && model.get('text') === newModel.get('text');
      });

      return optimisticModel;
    }
  });
  cocktail.mixin(ChatCollection, TroupeCollections.ReversableCollectionBehaviour);

  var ReadByModel = TroupeCollections.Model.extend({
    idAttribute: "id"
  });

  var ReadByCollection = TroupeCollections.LiveCollection.extend({
    model: ReadByModel,
    modelName: 'chatReadBy',
    initialize: function(models, options) {
      var userCollection = options.userCollection;
      if(userCollection) {
        this.transformModel = function(model) {
          var m = userCollection.get(model.id);
          if(m) return m.toJSON();

          return model;
        };
      }

      this.chatMessageId = options.chatMessageId;
      this.url = "/troupes/" + context.getTroupeId() + "/chatMessages/" + this.chatMessageId + "/readBy";
    }
  });

  return {
    ReadByModel: ReadByModel,
    ReadByCollection: ReadByCollection,
    ChatModel: ChatModel,
    ChatCollection: ChatCollection
  };
});
