/*jshint globalstrict:true, trailing:false */
/*global console:false, require: true, module: true */
"use strict";

var persistence = require("./persistence-service");
var appEvents = require("../app-events");
var fileService = require("./file-service");
var winston = require("../utils/winston");
var userService = require("./user-service");
var notificationService = require("./notification-service");
var conversationService = require("./conversation-service");


module.exports = {
  install: function() {
    /* File Events */
    appEvents.onFileEvent(function(data) {

      var troupeId = data.troupeId;
      var fileId = data.fileId;
      var version = data.version;

      fileService.findById(fileId, function(err, file) {
        if(err) return winston.error("notificationService: error loading file", err);
        if(!file) return winston.error("notificationService: unable to find file", fileId);

        var notificationData = {
          fileName: file.fileName,
          fileId: fileId,
          version: version
        };

        switch(data.event) {
          case 'createVersion':
            if(version > 1) {
              notificationService.createTroupeNotification(troupeId, "file:createVersion", notificationData);
            }
            break;

          case 'createNew':
            notificationService.createTroupeNotification(troupeId, "file:createNew", notificationData);
            break;
        }

      });

    });

    appEvents.onMailEvent(function(data) {
      var event =  data.event;
      var troupeId = data.troupeId;
      var conversationId = data.conversationId;
      var mailIndex = data.mailIndex;

      conversationService.findById(conversationId, function(err, conversation) {
        if(err) return winston.error("notificationService: error loading conversation", err);
        if(!conversation) return winston.error("notificationService: unable to find conversation", conversationId);
        var email = conversation.emails[mailIndex - 1];

        userService.findById(email.fromUserId, function(err, user) {
          if(err) return winston.error("notificationService: error loading user", err);
          if(!user) return winston.error("notificationService: unable to find user", email.fromUserId);

          var notificationData = {
            conversationId: conversationId,
            mailIndex: mailIndex,
            subject: email.subject,
            from: user.displayName,
            fromUserId: email.id
          };

          notificationService.createTroupeNotification(troupeId, "mail:" + event, notificationData);
        });

      });
    });

  }
}