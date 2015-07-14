"use strict";

var env                      = require('gitter-web-env');
var logger                   = env.logger;
var stats                    = env.stats;

var appEvents                = require('gitter-web-appevents');
var userService              = require('./user-service');
var persistence              = require('./persistence-service');
var assert                   = require("assert");
var mongoUtils               = require("../utils/mongo-utils");
var Q                        = require("q");
var ObjectID                 = require('mongodb').ObjectID;
var assert                   = require('assert');
var roomPermissionsModel     = require('./room-permissions-model');
var mongooseUtils            = require('../utils/mongoose-utils');
var StatusError              = require('statuserror');
var roomMembershipService    = require('./room-membership-service');

function findByUri(uri, callback) {
  var lcUri = uri.toLowerCase();

  return persistence.Troupe.findOneQ({ lcUri: lcUri })
    .nodeify(callback);
}

function findByIds(ids, callback) {
  return mongooseUtils.findByIds(persistence.Troupe, ids, callback);
}

function findByIdsLean(ids, select) {
  return mongooseUtils.findByIdsLean(persistence.Troupe, ids, select);
}

function findById(id, callback) {
  assert(mongoUtils.isLikeObjectId(id));

  return persistence.Troupe.findByIdQ(id)
    .nodeify(callback);
}

/**
 * @deprecated
 */
function findAllTroupesIdsForUser(userId) {
  return roomMembershipService.findRoomIdsForUser(userId);
}

/**
 * [{troupe without users}, userIsInRoom:boolean]
 */
function findByIdLeanWithAccess(troupeId, userId) {
  troupeId = mongoUtils.asObjectID(troupeId);
  if (userId) {
    return Q.all([
      persistence.Troupe.findOneQ({ _id: troupeId }, { }, { lean: true }),
      roomMembershipService.checkRoomMembership(troupeId, userId)
    ])
    .spread(function(leanTroupe, access) {
      if (!leanTroupe) return [null, false];
      leanTroupe.id = mongoUtils.serializeObjectId(leanTroupe._id);
      return [leanTroupe, access];
    });
  }

  // Query without userId
  return persistence.Troupe.findOneQ({ _id: troupeId }, { }, { lean: true })
    .then(function(result) {
      if (!result) return [null, false];
      result.id = mongoUtils.serializeObjectId(result._id);
      return [result, false];
    });
}

/**
 * @deprecated
 */
function userHasAccessToTroupe(user, troupe) {
  assert(false);
  if(!user) return false;
  return troupe.containsUserId(user.id);
}

/**
 * @deprecated
 */
function userIdHasAccessToTroupe(userId, troupe) {
  assert(false);
  return troupe.containsUserId(userId);
}

/**
 * Find the userIds of all the troupe.
 *
 * Candidate for redis caching potentially?
 * @deprecated
 */
function findUserIdsForTroupe(troupeId) {
  return roomMembershipService.findMembersForRoom(troupeId);
}

/**
 * Find usersIds for a troupe, with a limit.
 * Defaults to sort with non-lurk first, then join date
 * @deprecated
 */
function findUsersIdForTroupeWithLimit(troupeId, limit) {
  return roomMembershipService.findMembersForRoom(troupeId, { limit: limit });
}

/**
 * Returns a hash of users in the troupe their lurk status as the value.
 * @deprecated
 */
function findUserIdsForTroupeWithLurk(troupeId) {
  return roomMembershipService.findMembersForRoomWithLurk(troupeId);
}

function findOneToOneTroupe(fromUserId, toUserId) {
  if(fromUserId == toUserId) throw "You cannot be in a troupe with yourself.";
  assert(fromUserId, 'fromUserId parameter required');
  assert(toUserId, 'fromUserId parameter required');

  /* Find the existing one-to-one.... */
  return persistence.Troupe.findOneQ({
        $and: [
          { oneToOne: true },
          { 'oneToOneUsers.userId': fromUserId },
          { 'oneToOneUsers.userId': toUserId }
        ]
    });

}

/**
 * Returns true if the GitHub type for the uri matches
 * the provided github type
 */
function checkGitHubTypeForUri(uri, githubType) {
  var lcUri = uri.toLowerCase();

  return persistence.Troupe.countQ({ lcUri: lcUri, githubType: githubType })
    .then(function(count) {
      return !!count;
    });
}
/**
 * Create a one-to-one troupe if one doesn't exist, otherwise return the existing one.
 *
 * Does not check if the users have implicit connections - it always creates
 * the one to one
 *
 * NB NB NB: this is not atomic, so if two users try create the same troupe
 * at the same moment (to the millisecond) things will get nasty!
 *
 * @return {troupe} Promise of a troupe
 */
function findOrCreateOneToOneTroupe(userId1, userId2) {
  assert(userId1, "Need to provide user 1 id");
  assert(userId2, "Need to provide user 2 id");

  userId1 = mongoUtils.asObjectID(userId1);
  userId2 = mongoUtils.asObjectID(userId2);

  var insertFields = {
    oneToOne: true,
    status: 'ACTIVE',
    githubType: 'ONETOONE',
    oneToOneUsers: [ { _id: new ObjectID(), userId: userId1 },
             { _id: new ObjectID(), userId: userId2 }],
    userCount: 2
  };

  // Remove undefined fields
  Object.keys(insertFields).forEach(function(k) {
    if(insertFields[k] === undefined) {
      delete insertFields[k];
    }
  });

  // Need to use $elemMatch due to a regression in Mongo 2.6, see https://jira.mongodb.org/browse/SERVER-13843
  return mongooseUtils.upsert(persistence.Troupe, {
      $and: [
        { oneToOne: true },
        { 'oneToOneUsers': {$elemMatch: { userId: userId1 } }},
        { 'oneToOneUsers': {$elemMatch: { userId: userId2 } }}
        ]},
      {
        $setOnInsert: insertFields
      })
    .spread(function(troupe, updatedExisting) {
      if(updatedExisting) return troupe;

      return roomMembershipService.addRoomMembers(troupe.id, [userId1, userId2])
        .then(function() {
          logger.verbose('Created a oneToOne troupe for ', { userId1: userId1, userId2: userId2 });

          stats.event('new_troupe', {
            troupeId: troupe.id,
            oneToOne: true,
            userId: userId1,
            oneToOneUpgrade: false
          });

          // TODO: do this here to get around problems with
          // circular dependencies. This will probably need to change in
          // future
          var restSerializer = require('../serializers/rest-serializer');

          [userId1, userId2].forEach(function(currentUserId) {
            var url = '/user/' + currentUserId + '/rooms';

            var strategy = new restSerializer.TroupeStrategy({ currentUserId: currentUserId });

            restSerializer.serialize(troupe, strategy, function(err, serializedModel) {
              if(err) return logger.error('Error while serializing oneToOne troupe: ' + err, { exception: err });
              appEvents.dataChange2(url, 'create', serializedModel);
            });
          });

          return troupe;
        });
    });
}

/**
 * Find a one-to-one troupe, otherwise create it if possible (if there is an implicit connection),
 * otherwise return the existing invite if possible
 *
 * @return {[ troupe, other-user, invite ]}
 */
function findOrCreateOneToOneTroupeIfPossible(fromUserId, toUserId) {
  assert(fromUserId, 'fromUserId parameter required');
  assert(toUserId, 'toUserId parameter required');
  if(fromUserId === toUserId) throw new StatusError(417); // You cannot be in a troupe with yourself.

  return Q.all([
      userService.findById(toUserId),
      persistence.Troupe.findOneQ({
        $and: [
          { oneToOne: true },
          { 'oneToOneUsers.userId': fromUserId },
          { 'oneToOneUsers.userId': toUserId }
        ]
      })
    ])
    .spread(function(toUser, troupe) {
      if(!toUser) throw new StatusError(404, "User does not exist");

      // Found the troupe? Perfect!
      if(troupe) return [ troupe, toUser, null ];

      // For now, there is no permissions model between users
      // There is an implicit connection between these two users,
      // automatically create the troupe
      return findOrCreateOneToOneTroupe(fromUserId, toUserId)
        .then(function(troupe) {
          return [ troupe, toUser, null ];
        });

    });

}

function updateTopic(user, troupe, topic) {
  /* First check whether the user has permission to work the topic */
  return roomPermissionsModel(user, 'admin', troupe)
    .then(function(access) {
      if(!access) throw new StatusError(403); /* Forbidden */

      troupe.topic = topic;

      return troupe.saveQ()
        .then(function() {
          return troupe;
        });
    });
}

function toggleSearchIndexing(user, troupe, bool) {
  return roomPermissionsModel(user, 'admin', troupe)
    .then(function(access) {
      if(!access) throw new StatusError(403); /* Forbidden */

      troupe.noindex = bool;

      return troupe.saveQ()
        .then(function() {
          return troupe;
        });
    });
}

/**
 * @deprecated
 */
function findAllUserIdsForTroupes(troupeIds) {
  return roomMembershipService.findAllMembersForRooms(troupeIds);
}


/**
 * @deprecated
 */
function findAllUserIdsForTroupe(troupeId) {
  return roomMembershipService.findMembersForRoom(troupeId);
}

function deleteTroupe(troupe, callback) {
  // FIXME: NOCOMMIT
  assert(false);
  //
  // return Q.all([
  //   persistence.Troupe.removeQ({ troupeId: troupeId });
  // ])
  //
  // return Q.fcall(function() {
  //     if (troupe.oneToOne) {
  //       var userId0 = troupe.users[0] && troupe.users[0].userId;
  //       var userId1 = troupe.users[1] && troupe.users[1].userId;
  //       troupe.removeUserById(userId0);
  //       troupe.removeUserById(userId1);
  //
  //       return troupe.removeQ();
  //     } else {
  //       if(troupe.users.length !== 1) throw new Error("Can only delete troupes that have a single user");
  //
  //       troupe.status = 'DELETED';
  //       if (!troupe.dateDeleted) {
  //         troupe.dateDeleted = new Date();
  //       }
  //       troupe.removeUserById(troupe.users[0].userId);
  //
  //       return troupe.saveQ();
  //     }
  //   })
  //   .thenResolve(troupe)
  //   .nodeify(callback);
}

module.exports = {
  findByUri: findByUri,
  findById: findById,
  findByIds: findByIds,
  findByIdsLean: findByIdsLean,
  findByIdLeanWithAccess: findByIdLeanWithAccess,
  findAllTroupesIdsForUser: findAllTroupesIdsForUser,
  userHasAccessToTroupe: userHasAccessToTroupe,
  userIdHasAccessToTroupe: userIdHasAccessToTroupe,
  findAllUserIdsForTroupes: findAllUserIdsForTroupes,
  findAllUserIdsForTroupe: findAllUserIdsForTroupe,
  findUserIdsForTroupeWithLurk: findUserIdsForTroupeWithLurk,
  findUserIdsForTroupe: findUserIdsForTroupe,
  findUsersIdForTroupeWithLimit: findUsersIdForTroupeWithLimit,
  findOneToOneTroupe: findOneToOneTroupe,
  findOrCreateOneToOneTroupeIfPossible: findOrCreateOneToOneTroupeIfPossible,
  deleteTroupe: deleteTroupe,
  findOrCreateOneToOneTroupe: findOrCreateOneToOneTroupe,
  updateTopic: updateTopic,
  toggleSearchIndexing: toggleSearchIndexing,
  checkGitHubTypeForUri: checkGitHubTypeForUri
};
