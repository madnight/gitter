'use strict';

var gcm = require('node-gcm');
var notificationMessageGenerator = require('../../services/notifications/notification-message-generator');

function generateNewChatNotifications(notificationType, notificationDetails/*, device*/) {
  var room = notificationDetails.room;
  var chats = notificationDetails.chats;
  var message = notificationMessageGenerator(room, chats);

  return new gcm.Message({
    data: {
      id: room.id,
      name: room.name || room.uri,
      message: message // @trevorah - is this actually used?
    }
  });
}

function generateNotifications(notificationType, notificationDetails, device) {
  switch(notificationType) {
    case 'new_chat':
      return generateNewChatNotifications(notificationType, notificationDetails, device);
  }

}

module.exports = generateNotifications;
