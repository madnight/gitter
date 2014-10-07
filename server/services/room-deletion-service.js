/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var userService = require('./user-service');
var troupeService = require('./troupe-service');
var assert = require('assert');
var removeService = require('./remove-service');
var persistence = require('./persistence-service');
var Q = require('q');

var env    = require('../utils/env');
var logger = env.logger;

function removeUsersFromRoomOneAtATime(room, userIds) {
  return userService.findByIds(userIds)
    .then(function(users) {

      function removeNext() {
        if(users.length === 0) return;

        var user = users.shift();

        logger.info('Removing ' + user.username);
        return removeService.userLeaveRoom(room, user)
          .then(removeNext);
      }

      return removeNext();
    });
}

exports.removeByUri = function(uri) {
  assert(uri);

  return troupeService.findByUri(uri)
    .then(function(room) {
      var userIds = room.getUserIds();

      return removeUsersFromRoomOneAtATime(room, userIds)
        .thenResolve(room);
    })
    .then(function(room) {
      return room.removeQ();
    })
    .then(function(room) {
      return Q.all([
        persistence.ChatMessage.removeQ({ toTroupeId: room.id }),
        persistence.Event.removeQ({ toTroupeId: room.id }),
        // TODO: webhooks
        ]);
    });
};