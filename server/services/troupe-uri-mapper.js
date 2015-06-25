"use strict";

var persistence              = require("./persistence-service");
var userService              = require("./user-service");
var collections              = require("../utils/collections");
var mongoUtils               = require("../utils/mongo-utils");
var Q                        = require("q");

/**
 * Returns the URL a particular user would see if they wish to view a URL.
 * NB: this call has to query the db to get a user's username. Don't call it
 * inside a loop!
 */
function getUrlForTroupeForUserId(troupe, userId) {
  if(!troupe.oneToOne) {
    return Q.resolve("/" + troupe.uri);
  }

  var otherTroupeUser = troupe.users.filter(function(troupeUser) {
    return troupeUser.userId != userId;
  })[0];

  if(!otherTroupeUser) return Q.reject(new Error("Unable to determine other user for troupe#" + troupe.id));

  return userService.findUsernameForUserId(otherTroupeUser.userId)
    .then(function(username) {
      return username ? "/" + username
                      : "/one-one/" + otherTroupeUser.userId;
    });

}
exports.getUrlForTroupeForUserId = getUrlForTroupeForUserId;

function getUrlOfFirstAccessibleRoom(troupeIds, userId) {
  if (!troupeIds.length) return Q.resolve(null);

  return persistence.Troupe.aggregateQ([{
      $match: {
          _id: { $in: mongoUtils.asObjectIDs(troupeIds) },
          'users.userId': mongoUtils.asObjectID(userId),
          status: { $ne: 'DELETED' }
        }
    }, {
      $project: {
        uri: 1,
        oneToOne: 1,
        users: {
          $cond: {
            if: { $eq: ["$oneToOne", true] },
            then: "$users",
            else: null
          }
        }
      }
    }]).then(function(results) {
      var resultsHash = collections.indexById(results);
      for(var i = 0; i < troupeIds.length; i++) {
        var troupeId = troupeIds[i];
        var troupe = resultsHash[troupeId];

        if (troupe) {
          return getUrlForTroupeForUserId(troupe, userId);
        }
      }

      return null;
    });
}
exports.getUrlOfFirstAccessibleRoom = getUrlOfFirstAccessibleRoom;
