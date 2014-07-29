/*jslint node: true, unused:true */
/*global describe:true, it: true */
"use strict";

var testRequire = require('../../test-require');
var Q = require('q');
var mockito = require('jsmockito').JsMockito;
var assert = require('assert');

var times = mockito.Verifiers.times;
var never = times(0);
var once = times(1);

var userTroupeSettingsServiceStub = {
  '../user-troupe-settings-service': {
    getMultiUserTroupeSettings: function() {
      return Q.fcall(function() { return {}; });
    }
  }
};

var pushNotificationServiceStub = {
  canUnlockForNotification: function(x, y, z, callback) { callback(null, {}); }
};

var userServiceStub = {
  findById: function(userId, callback) { callback(null, {});}
};

var unreadItemServiceStub = {
  getUnreadItemsForUserTroupeSince: function(x, y, z, callback) {
    callback(null, { 'chat': ['chat1234567890'] });
  }
};

var notificationSerializerStub = {
  getStrategy: function(name) {
    return function() {
      this.name = name;
    };
  },
  serializeQ: function(item, strategy) {
    return Q.fcall(function() {
      if(strategy.name === 'troupeId') {
        return {id: 'serializedId', name: 'serializedName', url: 'serializedUrl'};
      } else if(strategy.name === 'chatId') {
        return [{id: 'serializedChatId', text: 'serializedText', fromUser: {displayName: 'serializedFromUser'}}];
      }
    });
  }
};

describe('push notification generator service', function() {

  it('should send a notification', function(done) {
    var mockSendUserNotification = mockito.mockFunction();
    mockito.when(mockSendUserNotification)().then(function(x, y, callback) { callback(); });

    var service = testRequire.withProxies('./services/notifications/push-notification-generator', {
      '../user-troupe-settings-service': userTroupeSettingsServiceStub,
      '../push-notification-service': pushNotificationServiceStub,
      '../user-service': userServiceStub,
      '../../gateways/push-notification-gateway': {
        sendUserNotification: mockSendUserNotification
      },
      '../unread-item-service': unreadItemServiceStub,
      '../../serializers/notification-serializer': notificationSerializerStub
    });

    service.sendUserTroupeNotification({ userId: 'userId1234', troupeId: '1234567890' }, 1, 'some setting', function(err) {
      if(err) return done(err);

      mockito.verify(mockSendUserNotification, once)();
      done();
    });
  });

  it('should not send for muted rooms', function(done) {
    var mockSendUserNotification = mockito.mockFunction();
    mockito.when(mockSendUserNotification)().then(function(x, y, callback) { callback(); });

    var service = testRequire.withProxies('./services/notifications/push-notification-generator', {
      '../user-troupe-settings-service': userTroupeSettingsServiceStub,
      '../push-notification-service': pushNotificationServiceStub,
      '../user-service': userServiceStub,
      '../../gateways/push-notification-gateway': {
        sendUserNotification: mockSendUserNotification
      },
      '../unread-item-service': unreadItemServiceStub,
      '../../serializers/notification-serializer': notificationSerializerStub
    });

    service.sendUserTroupeNotification({ userId: 'userId1234', troupeId: '1234567890' }, 1, 'mute', function(err) {
      if(err) return done(err);

      mockito.verify(mockSendUserNotification, never)();
      done();
    });
  });

  it('should serialize troupes and chats correctly', function(done) {
    var mockSendUserNotification = function(userId, notification) {
      assert.equal(userId, 'userId1234');
      assert.equal(notification.link, '/mobile/chat#serializedId');
      assert(notification.message.indexOf('serializedFromUser') >= 0, 'serialized unread chat data not found');
      done();
    };

    var service = testRequire.withProxies('./services/notifications/push-notification-generator', {
      '../user-troupe-settings-service': userTroupeSettingsServiceStub,
      '../push-notification-service': pushNotificationServiceStub,
      '../user-service': userServiceStub,
      '../../gateways/push-notification-gateway': {
        sendUserNotification: mockSendUserNotification
      },
      '../unread-item-service': unreadItemServiceStub,
      '../../serializers/notification-serializer': notificationSerializerStub
    });

    service.sendUserTroupeNotification({ userId: 'userId1234', troupeId: '1234567890' }, 1, 'some setting', function(err) {
      if(err) return done(err);
    });
  });

});
