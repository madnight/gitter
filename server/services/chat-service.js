/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var persistence   = require("./persistence-service");
var collections   = require("../utils/collections");
var troupeService = require("./troupe-service");
var statsService  = require("./stats-service");
var urlExtractor  = require('../utils/url-extractor');
var safeHtml      = require('../utils/safe-html');
var ent           = require('ent');
var processChat   = require('../utils/process-chat');
var _             = require('underscore');

/*
 * Hey Trouper!
 * Bump the version if you modify the behaviour of TwitterText.
 */
var VERSION_INITIAL; /* = undefined; All previous versions are null due to a bug */
var VERSION_SWITCH_TO_SERVER_SIDE_RENDERING = 5;

var CURRENT_META_DATA_VERSION = VERSION_SWITCH_TO_SERVER_SIDE_RENDERING;

/* @const */
var MAX_CHAT_EDIT_AGE_SECONDS = 300;

var ObjectID = require('mongodb').ObjectID;

exports.newRichMessageToTroupe = function(troupe, user, text, meta, callback) {
  if(!troupe) return callback("Invalid troupe");

  var chatMessage = new persistence.ChatMessage();

  chatMessage.fromUserId = user ? user.id : null;

  chatMessage.toTroupeId = troupe.id;
  chatMessage.sent = new Date();

  // Very important that we decode and re-encode!
  text = ent.decode(text);
  text = safeHtml(text); // NB don't use ent for encoding as it's a bit overzealous!

  chatMessage.text     = text;
  chatMessage._md      = CURRENT_META_DATA_VERSION;
  chatMessage.meta     = meta;

  // Skip UnreadItems, except when new files are uploaded
  chatMessage.skipAlerts = meta.type === 'file' ? false : true;

  chatMessage.save(function (err) {
    if(err) return callback(err);

    return callback(null, chatMessage);
  });
};


exports.newChatMessageToTroupe = function(troupe, user, text, callback) {
  if(!troupe) return callback("Invalid troupe");

  if(!troupeService.userHasAccessToTroupe(user, troupe)) return callback(403);

  var chatMessage = new persistence.ChatMessage();
  chatMessage.fromUserId = user.id;
  chatMessage.toTroupeId = troupe.id;
  chatMessage.sent = new Date();

  // Keep the raw message.
  chatMessage.text      = text;

  var parsedMessage = processChat(text);
  chatMessage.html  = parsedMessage.html;

  // Metadata
  chatMessage.urls      = parsedMessage.urls;
  chatMessage.mentions  = parsedMessage.mentions;
  chatMessage.issues    = parsedMessage.issues;
  chatMessage._md       = CURRENT_META_DATA_VERSION;

  chatMessage.save(function (err) {
    if(err) return callback(err);

    statsService.event("new_chat", {
      userId: user.id,
      troupeId: troupe.id,
      username: user.username
    });

    return callback(null, chatMessage);
  });
};

exports.updateChatMessage = function(troupe, chatMessage, user, newText, callback) {
  var age = (Date.now() - chatMessage.sent.valueOf()) / 1000;
  if(age > MAX_CHAT_EDIT_AGE_SECONDS) {
    return callback("You can no longer edit this message");
  }

  if(chatMessage.toTroupeId != troupe.id) {
    return callback("Permission to edit this chat message is denied.");
  }

  if(chatMessage.fromUserId != user.id) {
    return callback("Permission to edit this chat message is denied.");
  }

  // If the user has been kicked out of the troupe...
  if(!troupeService.userHasAccessToTroupe(user, troupe)) {
    return callback("Permission to edit this chat message is denied.");
  }


  // Very important that we decode and re-encode!
  newText = ent.decode(newText);
  newText = _.escape(newText); // NB don't use ent for encoding as it's a bit overzealous!

  chatMessage.text = newText;
  chatMessage.editedAt = new Date();

  var parsedMessage = processChat(newText);
  chatMessage.html = parsedMessage.html;

  // Metadata
  chatMessage.urls      = parsedMessage.urls;
  chatMessage.mentions  = parsedMessage.mentions;
  chatMessage.issues    = parsedMessage.issues;
  chatMessage._md       = urlExtractor.version;

  chatMessage.save(function(err) {
    if(err) return callback(err);

    return callback(null, chatMessage);
  });
};

exports.findById = function(id, callback) {
  persistence.ChatMessage.findById(id, function(err, chatMessage) {
    callback(err, chatMessage);
  });
};

 exports.findByIds = function(ids, callback) {
  persistence.ChatMessage
    .where('_id')['in'](collections.idsIn(ids))
    .exec(callback);
};

function massageMessages(message) {
  if('html' in message && 'text' in message) {

    if(message._md == VERSION_INITIAL) {
      var text = _.unescape(message.text);
      var d = processChat(text);

      message.text      = text;
      message.html      = d.html;
      message.urls      = d.urls;
      message.mentions  = d.mentions;
      message.issues    = d.issues;
    }
  }

  return message;
}

exports.findChatMessagesForTroupe = function(troupeId, options, callback) {
  var q = persistence.ChatMessage
    .where('toTroupeId', troupeId);

  if(options.startId) {
    var startId = new ObjectID(options.startId);
    q = q.where('_id').gte(startId);
  }

  if(options.beforeId) {
    var beforeId = new ObjectID(options.beforeId);
    q = q.where('_id').lt(beforeId);
  }

  q.sort(options.sort || { sent: 'desc' })
    .limit(options.limit || 50)
    .skip(options.skip || 0)
    .exec(function(err, results) {
      if(err) return callback(err);

      return callback(null, results.map(massageMessages).reverse());
    });
};
