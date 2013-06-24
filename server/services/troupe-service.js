/*jshint globalstrict:true, trailing:false, unused:true, node:true */
/*global require: true, module: true */
"use strict";

var persistence = require("./persistence-service"),
    userService = require("./user-service"),
    appEvents = require("../app-events"),
    emailNotificationService = require("./email-notification-service"),
    presenceService = require("./presence-service"),
    uuid = require('node-uuid'),
    winston = require("winston"),
    collections = require("../utils/collections"),
    Fiber = require("../utils/fiber"),
    Q = require("q"),
    _ = require('underscore'),
    assert = require('assert'),
    statsService = require("../services/stats-service");

var ObjectID = require('mongodb').ObjectID;

function findByUri(uri, callback) {
  return persistence.Troupe.findOneQ({uri: uri})
    .nodeify(callback);
}

function findByIds(ids, callback) {
  persistence.Troupe
    .where('_id')['in'](collections.idsIn(ids))
    .exec(callback);
}

function findById(id, callback) {
  persistence.Troupe.findById(id, callback);
}

function findMemberEmails(id, callback) {
  findById(id, function(err,troupe) {
    if(err) callback(err);
    if(!troupe) callback("No troupe returned");

    var userIds = troupe.getUserIds();

    userService.findByIds(userIds, function(err, users) {
      if(err) callback(err);
      if(!users) callback("No users returned");

      var emailAddresses = users.map(function(item) { return item.email; } );

      callback(null, emailAddresses);
    });

  });
}

function findAllTroupesForUser(userId, callback) {
  persistence.Troupe
    .where('users.userId', userId)
    .sort({ name: 'asc' })
    .slaveOk()
    .exec(callback);
}

function findAllTroupesIdsForUser(userId, callback) {
  persistence.Troupe
    .where('users.userId', userId)
    .select('id')
    .slaveOk()
    .exec(function(err, result) {
      if(err) return callback(err);

      var troupeIds = result.map(function(troupe) { return troupe.id; } );
      return callback(null, troupeIds);
    });
}

function userHasAccessToTroupe(user, troupe) {
  return troupe.containsUserId(user.id);
}

function userIdHasAccessToTroupe(userId, troupe) {
  return troupe.containsUserId(userId);
}

function validateTroupeEmail(options, callback) {
  var from = options.from;
  var to = options.to;

  /* TODO: Make this email parsing better! */
  var uri = to.split('@')[0];

  userService.findByEmail(from, function(err, fromUser) {
    if(err) return callback(err);
    if(!fromUser) return callback("Access denied");

    findByUri(uri, function(err, troupe) {
      if(err) return callback(err);
      if(!troupe) return callback("Troupe not found for uri " + uri);

      if(!userHasAccessToTroupe(fromUser, troupe)) {
        return callback("Access denied");
      }

      return callback(null,troupe, fromUser);

    });
  });
}

function validateTroupeEmailAndReturnDistributionList(options, callback) {
  var from = options.from;
  var to = options.to;

  /* TODO: Make this email parsing better! */
  var uri = to.split('@')[0];

  userService.findByEmail(from, function(err, fromUser) {
    if(err) return callback(err);
    if(!fromUser) return callback("Access denied");

    findByUri(uri, function(err, troupe) {
      if(err) return callback(err);
      if(!troupe) return callback("Troupe not found for uri " + uri);
      if(!userHasAccessToTroupe(fromUser, troupe)) {
        return callback("Access denied");
      }

      userService.findByIds(troupe.getUserIds(), function(err, users) {
        if(err) return callback(err);

        var emailAddresses = users.map(function(user) {
          return user.email;
        });

        return callback(null, troupe, fromUser, emailAddresses);
      });
    });
  });
}

/*
 * This function takes in a userId and a list of troupes
 * It returns a hash that tells whether the user has access to each troupe,
 * or null if the troupe represented by the uri does not exist.
 * For example:
 * For the input validateTroupeUrisForUser('1', ['a','b','c'],...)
 * The callback could return:
 * {
 *   'a': true,
 *   'b': false,
 *   'c': null
 * }
 * Mean: User '1' has access to 'a', no access to 'b' and no troupe 'c' exists
 */
function validateTroupeUrisForUser(userId, uris, callback) {
  persistence.Troupe
    .where('uri')['in'](uris)
    .where('status', 'ACTIVE')
    .exec(function(err, troupes) {
      if(err) return callback(err);

      var troupesByUris = collections.indexByProperty(troupes, "uri");

      var result = {};
      uris.forEach(function(uri) {
        var troupe = troupesByUris[uri];
        if(troupe) {
          result[uri] = troupe.containsUserId(userId);
        } else {
          result[uri] = null;
        }
      });

      callback(null, result);
    });
}

function inviteUserByUserId(troupe, oneToOneUserId, senderDisplayName, userId, callback) {

  // Find the user
  return userService.findById(userId)
      .then(function(user) {
        if(!user) throw "User not found";

        // Check if the user is online
        var d = Q.defer();
        presenceService.categorizeUsersByOnlineStatus([userId], d.makeNodeResolver());

        return d.promise.then(function(onlineUsers) {
          var userIsOnline = onlineUsers && onlineUsers[userId];

          // Look for an existing invite
          var query = { status: "UNUSED", $or: [ { userId: userId } , { email: user.email } ] };
          if(oneToOneUserId) {
            query.fromOneToOneUserId = oneToOneUserId;
          } else {
            query.troupeId = troupe.id;
          }

          return persistence.Invite.findOneQ(query)
            .then(function(existingInvite) {

              // Existing invite? Use it
              if (existingInvite) {
                return existingInvite;
              }

              // No exiting invite, create a new invite
              return persistence.Invite.createQ({
                troupeId: troupe ? troupe.id : undefined,
                fromOneToOneUserId: oneToOneUserId,
                senderDisplayName: senderDisplayName,
                displayName: user.displayName,
                userId: user.id,
                email: user.email,
                code: uuid.v4(),
                emailSentAt: userIsOnline ? undefined: Date.now()
              });

            }).then(function(invite) {
              // Notify the user of the invite.
              if (!userIsOnline) {
                emailNotificationService.sendInvite(troupe, user.displayName, user.email, invite.code, senderDisplayName);
              } else {
                var text, uri;
                if(troupe) {
                  text = "You've been invited to join the Troupe: " + troupe.name;
                  uri = troupe.uri;
                } else {
                  text = "You've been invited to chat with XXXXXXX";
                  uri = "YYYYYYY";
                }

                appEvents.userNotification({
                  userId: userId,
                  troupeId: troupe ? troupe.id : undefined,
                  // TODO: add onetoone bits in to this invite
                  title: "New Invitation",
                  text: text,
                  link: uri,
                  sound: "invitation"
                });
              }

              return invite;
            });
          });
    })
    .nodeify(callback);
}

function inviteUserByEmail(troupe, fromOneToOneUserId, senderDisplayName, displayName, email, callback) {

  // Only non-registered users should go through this flow.
  // Check if the email is registered to a user.
  return userService.findByEmail(email)
      .then(function(user) {

        if(user) {
          return inviteUserByUserId(troupe, fromOneToOneUserId, senderDisplayName, user.id);
        }

        return persistence.Invite.findOneQ({ status: "UNUSED", troupeId: troupe.id, email: email })
            .then(function(existingInvite) {
              if(existingInvite) {
                emailNotificationService.sendInvite(troupe, displayName, email, existingInvite.code, senderDisplayName);

                return existingInvite;
              }

              statsService.event('new_user_invite', { senderDisplayName: senderDisplayName, email: email });


              // create the invite and send mail immediately
              var code = uuid.v4();

              return persistence.Invite.createQ({
                troupeId: troupe.id,
                senderDisplayName: senderDisplayName,
                displayName: displayName,
                email: email,
                emailSentAt: Date.now(),
                code: code
              }).then(function(invite) {
                emailNotificationService.sendInvite(troupe, displayName, email, code, senderDisplayName);
                return invite;
              });
            });
      })
      .nodeify(callback);
}

function inviteUserToTroupe(troupe, senderDisplayName, invite, callback) {
  if(invite.email) {
    inviteUserByEmail(troupe, null, senderDisplayName, invite.displayName, invite.email, callback);

    return;
  }

  if(invite.userId) {
    inviteUserByUserId(troupe, null, senderDisplayName, invite.userId, callback);

    return;
  }

  // Otherwise, if neither an email or userId are sent, just quietely ignore
  return callback();
}

function findInviteById(id, callback) {
  persistence.Invite.findById(id, callback);
}

function findInviteByCode(code, callback) {
  persistence.Invite.findOne({code: code}, function(err, invite) {
    callback(err, invite);
  });
}

function findAllUnusedInvitesForTroupe(troupeId, callback) {
   persistence.Invite.where('troupeId').equals(troupeId)
      .where('status').equals('UNUSED')
      .sort({ displayName: 'asc', email: 'asc' } )
      .slaveOk()
      .exec(callback);
}

function findUnusedInviteToTroupeForEmail(email, troupeId, callback) {
  persistence.Invite.findOne({ troupeId: troupeId, email: email, status: 'UNUSED' }, callback);
}


function findUnusedInviteToTroupeForUserId(userId, troupeId, callback) {
  return persistence.Invite.findOneQ({ troupeId: troupeId, userId: userId, status: 'UNUSED' }).nodeify(callback);
}

function findUnusedOneToOneInviteFromUserIdToUserId(fromUserId, toUserId, callback) {
  return persistence.Invite.findOneQ({
      fromOneToOneUserId: fromUserId,
      userId: toUserId,
      status: 'UNUSED'
    }).nodeify(callback);
}
function updateInvitesForEmailToUserId(email, userId, callback) {
  return persistence.Invite.updateQ(
    { email: email },
    { userId: userId },
    { multi: true })
    .then(function() {
      return true;
    })
    .nodeify(callback);
}

function findAllUnusedInvitesForUserId(userId, callback) {
  return persistence.Invite.where('userId').equals(userId)
    .where('status').equals('UNUSED')
    .sort({ displayName: 'asc', email: 'asc' } )
    .execQ()
    .nodeify(callback);
}

function findAllUnusedInvitesForEmail(email, callback) {
  persistence.Invite.where('email').equals(email)
    .where('status').equals('UNUSED')
    .sort({ displayName: 'asc', email: 'asc' } )
    .exec(callback);
}

function removeUserFromTroupe(troupeId, userId, callback) {
  findById(troupeId, function(err, troupe) {
    if(err) return callback(err);
    if(!troupe) return callback('Troupe ' + troupeId + ' does not exist.');

    // TODO: Add the user to a removeUsers collection
    var deleteRecord = new persistence.TroupeRemovedUser({
      userId: userId,
      troupeId: troupeId
    });

    deleteRecord.save(function(err) {
      if(err) return callback(err);

      // TODO: Let the user know that they've been removed from the troupe (via email or something)
      troupe.removeUserById(userId);
      if(troupe.users.length === 0) {
        return callback("Cannot remove the last user from a troupe");
      }
      troupe.save(callback);
    });
  });
}


/*
 * callback is function(err, request)
 */
function addRequest(troupeId, userId, callback) {

  return persistence.Request.findOneQ({
    troupeId: troupeId,
    userId: userId,
    status: 'PENDING'})
    .then(function(request) {
      // Request already made....
      if(request) return request;

      return persistence.Troupe.findOneQ(troupeId)
          .then(function(troupe) {
            if(!troupe) return "Unable to find troupe";
            if(userIdHasAccessToTroupe(userId, troupe)) {
              throw { memberExists: true };
            }

            return  persistence.Request.createQ({
              troupeId: troupeId,
              userId: userId
            });

          });

    }).nodeify(callback);
}

/*
 * callback is function(err, requests)
 */
function findAllOutstandingRequestsForTroupe(troupeId, callback) {
  persistence.Request
      .where('troupeId', troupeId)
      .where('status', 'PENDING')
      .slaveOk()
      .exec(callback);
}

function findPendingRequestForTroupe(troupeId, id, callback) {
  persistence.Request.findOne( {
    troupeId: troupeId,
    _id: id,
    status: 'PENDING'
  }, callback);
}


function findRequestsByIds(requestIds, callback) {

  persistence.Request
    .where('_id')['in'](requestIds)
    .exec(callback);

}

function findUserByIdEnsureConfirmationCode(userId, callback) {
  userService.findById(userId, function(err, user) {
    if(err) return callback(err);
    if(!user) return callback();

    // If the user doesn't have a confirmation code, give them one now
    if(!user.confirmationCode) {
      winston.info('User ' + userId + ' had no confirmation code, generating one now');
      user.confirmationCode = uuid.v4();
      user.save(function(err) {
        if(err) return callback(err);
        callback(null, user);
      });

      return;
    }

    return callback(null, user);
  });
}

function acceptRequest(request, callback) {
  winston.verbose('Accepting request to join ' + request.troupeId);

  findById(request.troupeId, function(err, troupe) {
    if(err) return callback(err);
    if(!troupe) { winston.error("Unable to find troupe", request.troupeId); return callback("Unable to find troupe"); }

    if(troupe.status != 'ACTIVE') callback({ troupeNoLongerActive: true });

    findUserByIdEnsureConfirmationCode(request.userId, function(err, user) {
      if(err) return callback(err);
      if(!user) { winston.error("Unable to find user", request.userId); return callback("Unable to find user"); }


      if(user.status === 'UNCONFIRMED') {
        emailNotificationService.sendConfirmationForNewUserRequest(user, troupe);
      } else {
        emailNotificationService.sendRequestAcceptanceToUser(user, troupe);
      }

      /** Add the user to the troupe */
      troupe.addUserById(user.id);

      troupe.save(function(err) {
        if(err) winston.error("Unable to save troupe", err);

        request.remove();
        return callback(err, request);
      });

    });
  });
}


function rejectRequest(request, callback) {
  findById(request.troupeId, function(err, troupe) {
    if(err) return callback(err);
    if(!troupe) { winston.error("Unable to find troupe", request.troupeId); return callback("Unable to find troupe"); }


    request.remove(function(err) {
      if(err) winston.error("Unable to save request", err);
      return callback(null);
    });
  });
}

function findUserIdsForTroupe(troupeId, callback) {
  persistence.Troupe.findById(troupeId, 'users', function(err, troupe) {
    if(err) return callback(err);
    callback(null, troupe.users.map(function(m) { return m.userId; }));
  });
}

function findUsersForTroupe(troupeId, callback) {
  persistence.Troupe.findById(troupeId, 'users', function(err, user) {
    if(err) return callback(err);
    callback(null, user.users);
  });
}

function updateTroupeName(troupeId, troupeName, callback) {
  findById(troupeId, function(err, troupe) {
    if (err) return callback(err);
    if (!troupe) return callback("Troupe not found");

    troupe.name = troupeName;
    troupe.save(function(err) {
      callback(err, troupe);
    });
  });
}

function createOneToOneTroupe(userId1, userId2, callback) {
  return persistence.Troupe.createQ({
      uri: null,
      name: '',
      oneToOne: true,
      status: 'ACTIVE',
      users: [
        { userId: userId1 },
        { userId: userId2 }
      ]
    }).nodeify(callback);
}

// Returns true if the two users share a common troupe
// In future, will also return true if the users share an organisation
function findImplicitConnectionBetweenUsers(userId1, userId2, callback) {
  return persistence.Troupe.findOneQ({
          $and: [
            { 'users.userId': userId1 },
            { 'users.userId': userId2 }
          ]
        }, "_id")
    .then(function(troupe) {
      return !!troupe;
    })
    .nodeify(callback);
}

/**
 * Find an existing invite or create a new invite for one user to connect to another user
 * @param  {[type]} fromUserId
 * @param  {[type]} toUserId
 * @return {promise}
 */
function findOrCreateOneToOneInvite(fromUserId, toUserId) {

  /* Find an existing one-to-one.... */
  return Q.all([
      persistence.Troupe.findOneQ({
        $and: [
          { oneToOne: true },
          { 'users.userId': fromUserId },
          { 'users.userId': toUserId }
        ]
      }),
      userService.findById(fromUserId)
    ]).spread(function(existingTroupe, fromUser) {
        if(existingTroupe) throw new Error('A connection already exists between these users');
        if(!fromUser) throw new Error('User ' + fromUserId + ' not found');

        return inviteUserByUserId(null, fromUserId, fromUser.displayName, toUserId);
      });
}

/**
 * Find a one-to-one troupe, otherwise create it if possible (if there is an implicit connection),
 * otherwise return the existing invite if possible
 *
 * @return {[ troupe, other-user, invite ]}
 */
function findOrCreateOneToOneTroupe(currentUserId, userId2, callback) {
  if(currentUserId == userId2) return callback("You cannot be in a troupe with yourself.");

  return userService.findById(userId2)
    .then(function(user2) {
      if(!user2) throw "User does not exist";

      /* Find the existing one-to-one.... */
      return [user2, persistence.Troupe.findOneQ({
        $and: [
          { oneToOne: true },
          { 'users.userId': currentUserId },
          { 'users.userId': userId2 }
        ]
      })];
    })
    .spread(function(user2, troupe) {

      // Found the troupe? Perfect!
      if(troupe) return [ troupe, user2, null ];

      return findImplicitConnectionBetweenUsers(currentUserId, userId2)
          .then(function(implicitConnection) {
            if(implicitConnection) {
              // There is an implicit connection between these two users,
              // automatically create the troupe
              return createOneToOneTroupe(currentUserId, userId2)
                .then(function(troupe) {
                  return [ troupe, user2, null ];
                });
            }

            // There is no implicit connection between the users, don't create the troupe
            // However, do tell the caller whether or not this user already has an invite to the
            // other user to connect

            // Otherwise the users cannot onnect the and the user will need to invite the other user
            // to connect explicitly.
            // Check if the user has already invited the other user to connect
            return findUnusedOneToOneInviteFromUserIdToUserId(currentUserId, userId2)
              .then(function(invite) {
                return [ null, user2, invite ];
              });

          });

    })
    .nodeify(callback);

}

function upgradeOneToOneTroupe(options, callback) {
  var name = options.name;
  var senderName = options.senderName;
  var invites = options.invites;
  var origTroupe = options.oneToOneTroupe.toObject();

  // create a new, normal troupe, with the current users from the one to one troupe
  var troupe = new persistence.Troupe({
    uri: createUniqueUri(),
    name: name,
    status: 'ACTIVE',
    users: origTroupe.users
  });

  troupe.save(function(err) {
    if(err) return callback(err);

    if(!invites || invites.length === 0) {
      return callback(null, troupe);
    }

    var f = new Fiber();

    // add invites for each additional person
    for(var i = 0; i < invites.length; i++) {
      inviteUserToTroupe(troupe, senderName, invites[i], f.waitor());
    }

    f.all().then(function() { callback(null, troupe); }, callback);
  });
}

function createUniqueUri() {
  var chars = "0123456789abcdefghiklmnopqrstuvwxyz";

  var uri = "";
  for(var i = 0; i < 6; i++) {
    var rnum = Math.floor(Math.random() * chars.length);
    uri += chars.substring(rnum, rnum + 1);
  }

  return uri;
}

function updateFavourite(userId, troupeId, isFavourite, callback) {
  var setOp = {};
  setOp['favs.' + troupeId] = '1';
  var updateStatement;
  var updateOptions;

  if(isFavourite) {
    updateStatement = { $set: setOp };
    updateOptions = { upsert: true };
  } else {
    updateStatement = { $unset: setOp };
    updateOptions = { };
  }

  persistence.UserTroupeFavourites.update(
    { userId: userId },
    updateStatement,
    updateOptions,
    callback);
}

function findFavouriteTroupesForUser(userId, callback) {
  persistence.UserTroupeFavourites.findOne({ userId: userId}, function(err, userTroupeFavourites) {
    if(err) return callback(err);
    if(!userTroupeFavourites || !userTroupeFavourites.favs) return callback(null, {});

    return callback(null, userTroupeFavourites.favs);
  });
}

function findAllUserIdsForTroupes(troupeIds, callback) {
  if(!troupeIds.length) return callback(null, []);

  var mappedTroupeIds = troupeIds.map(function(d) {
    if(typeof d === 'string') return new ObjectID('' + d);
    return d;
  });

  persistence.Troupe.aggregate([
    { $match: { _id: { $in: mappedTroupeIds } } },
    { $project: { _id: 0, 'users.userId': 1 } },
    { $unwind: '$users' },
    { $group: { _id: 1, userIds: { $addToSet: '$users.userId' } } }
    ], function(err, results) {
      if(err) return callback(err);
      var result = results[0];
      if(!result || !result.userIds || !result.userIds.length) return callback(null, []);

      return callback(null, result.userIds);
    });
}


function findBestTroupeForUser(user, callback) {
  //
  // This code is invoked when a user's lastAccessedTroupe is no longer valid (for the user)
  // or the user doesn't have a last accessed troupe. It looks for all the troupes that the user
  // DOES have access to (by querying the troupes.users collection in mongo)
  // If the user has a troupe, it takes them to the last one they accessed. If the user doesn't have
  // any valid troupes, it returns an error.
  //

  if (user.lastTroupe) {
    findById(user.lastTroupe, function(err,troupe) {
      if(err) return callback(err);

      if(!troupe || troupe.status == 'DELETED' || !userHasAccessToTroupe(user, troupe)) {
        return findLastAccessedTroupeForUser(user, callback);
      }

      callback(null, troupe);
    });
    return;
  }

  return findLastAccessedTroupeForUser(user, callback);
}

function findLastAccessedTroupeForUser(user, callback) {
  persistence.Troupe.find({ 'users.userId': user.id, 'status': 'ACTIVE' }, function(err, activeTroupes) {
    if(err) return callback(err);
    if (!activeTroupes || activeTroupes.length === 0) callback(null, null);

    userService.getTroupeLastAccessTimesForUser(user.id, function(err, troupeAccessTimes) {
      if(err) return callback(err);

      activeTroupes.forEach(function(troupe) {
        troupe.lastAccessTime = troupeAccessTimes[troupe._id];
      });

      var troupes = _.sortBy(activeTroupes, function(t) {
        return (t.lastAccessTime) ? t.lastAccessTime : 0;
      }).reverse();

      _.find(troupes, function(troupe) {

        if (userHasAccessToTroupe(user, troupe)) {
          callback(null, troupe);
          return true;
        }
      });
    });

  });

}

//
// Create a new troupe and return callback(err, troupe)
//
function createNewTroupeForExistingUser(options, callback) {
  var name = options.name;
  var oneToOneTroupeId = options.oneToOneTroupeId;
  var user = options.user;
  var invites = options.invites;

  name = name ? name.trim() : '';
  if(!name) return callback('Please provide a troupe name');

  if (oneToOneTroupeId) {
    // find this 1-1 troupe and create a new normal troupe with the additional person(s) invited
    findById(oneToOneTroupeId, function(err, troupe) {
      if(!userHasAccessToTroupe(user, troupe)) {
        return callback(403);
      }

      upgradeOneToOneTroupe({ name: name, oneToOneTroupe: troupe, senderName: user.name, invites: invites }, callback);
    });

    return;
  }

  // create a troupe normally
  var troupe = new persistence.Troupe();
  troupe.name = name;
  troupe.uri = createUniqueUri();
  troupe.addUserById(user.id);

  troupe.save(function(err) {
    if(err) return callback(err);

    var f = new Fiber();

    if (invites) {
      // add invites for each additional person
      for(var i = 0; i < invites.length; i++) {
        var displayName = invites[i].displayName;
        var inviteEmail = invites[i].email;
        if (displayName && inviteEmail)
          inviteUserToTroupe(troupe, user.displayName, invites[i], f.waitor());
        }
    }

    f.all().then(function() {
      callback(null, troupe);
    }, callback);
  });
}

// so that the invite doesn't show up in the receiver's list of pending invitations
// marks the invite as used
function rejectInviteForAuthenticatedUser(user, inviteId, callback) {
  assert(user); assert(inviteId);

  findInviteById(inviteId, function(err, invite) {
    if(err) return callback(err);

    if(invite.email !== user.email && invite.userId !== user.id) {
      return callback(401);
    }

    if(!invite) {
      winston.error("Invite id=" + inviteId + " not found. ");
      return callback(null, null);
    }

    statsService.event('invite_rejected', { inviteId: inviteId });
    winston.verbose("Invite rejected", { inviteId: inviteId });

    // delete the invite
    deleteAllInvitesToTroupeForUser(invite.troupeId, user.email, callback);
  });

}

function acceptInviteForAuthenticatedUser(user, inviteId, callback) {
  assert(user); assert(inviteId);
  // check that the logged in user owns this invite
  // mark as used.
  findInviteById(inviteId, function(err, invite) {
    if(err) return callback(err);

    if(invite.email !== user.email && invite.userId !== user.id) {
      return callback(401);
    }

    if(!invite) {
      winston.error("Invite inviteId=" + inviteId + " not found. ");
      return callback("No such invite found");
    }

    if(invite.status !== 'UNUSED') {
      // invite has been used, we can't use it again.
      winston.verbose("Invite has already been used", { inviteId: invite.id });
      statsService.event('invite_reused', { inviteId: inviteId });

      callback("Invite has already been used");
    } else {
      // use and delete invite
      statsService.event('invite_accepted', { inviteId: inviteId });
      winston.verbose("Invite accepted", { inviteId: inviteId });

      // find the troupe
      findById(invite.troupeId, function(err, troupe) {
        if(err) return callback(err);
        if(!troupe) return callback(404);
        if(troupe.status != 'ACTIVE') return callback({ troupeNoLongerActive: true });

        troupe.addUserById(user.id);
        troupe.save(function(err) {
          if(err) return callback(err);

          deleteAllInvitesToTroupeForUser(invite.troupeId, invite.email, callback);
        });

      });
    }

  });
}

// Accept an invite, returns callback(err, user, alreadyExists)
// NB NB NB user should only ever be set iff the invite is valid
function acceptInvite(confirmationCode, troupeUri, callback) {
  findInviteByCode(confirmationCode, function(err, invite) {
    if(err) return callback(err);

    if(!invite) {
      winston.error("Invite confirmationCode=" + confirmationCode + " not found. ");
      return callback(null, null);
    }

    if(invite.status !== 'UNUSED') {
      /* The invite has already been used. We need to fail authentication (if they have completed their profile), but go to the troupe */
      winston.verbose("Invite has already been used", { confirmationCode: confirmationCode, troupeUri: troupeUri });
      statsService.event('invite_reused', { uri: troupeUri });

      // There's a chance a user has accepted an invite but hasn't completed their profile
      // In which case we allow them through
      userService.findByEmail(invite.email, function(err, user) {
        if(err) return callback(err);

        // If the user has clicked on the invite, but hasn't completed their profile (as in does not have a password)
        // then we'll give them a special dispensation and allow them to access the site (otherwise they'll never get in)
        if (user && user.status == 'PROFILE_NOT_COMPLETED') {
          return callback(null, user, false);
        }

        return callback(null, null, true);
      });

    } else {
      statsService.event('invite_accepted', { uri: troupeUri });

      winston.verbose("Invite accepted", { confirmationCode: confirmationCode, troupeUri: troupeUri });

      userService.findOrCreateUserForEmail({
        displayName: invite.displayName,
        email: invite.email,
        status: "PROFILE_NOT_COMPLETED"
      }, function(err, user) {
        if(err) return callback(err);

        // confirm the user if they are not already.
        if (user.status == 'UNCONFIRMED') {
          user.status = 'PROFILE_NOT_COMPLETED';
          user.save();
        }

        // add the user to the troupe
        findById(invite.troupeId, function(err, troupe) {
          if(err) return callback(err);
          if(!troupe) return callback(404);
          if(troupe.status != 'ACTIVE') return callback({ troupeNoLongerActive: true });

          var originalStatus = invite.status;
          if(originalStatus != 'UNUSED') {
            return callback(null, null, true);
          }

          // if the user is active, delete the invite
          if (user.status == "ACTIVE") {
            deleteAllInvitesToTroupeForUser(invite.troupeId, invite.email, saveTroupe);
          }
          // if the user has not yet completed their profile,
          // we keep the invite as 'USED' so that they can login again.
          // all outstanding used invites will be deleted when they complete their profile.
          else {
            invite.status = 'USED';

            invite.save(saveTroupe);
          }

          function saveTroupe() {
            if(err) return callback(err);

            troupe.addUserById(user.id);
            troupe.save(function(err) {
              if(err) return callback(err);
              return callback(null, user, false);
            });

          }
        });
      });
    }

  });
}

function sendPendingInviteMails(delaySeconds, callback) {
  var count = 0;
  delaySeconds = (delaySeconds === null) ? 10 * 60 : delaySeconds;
  var searchParams = {
    status: "UNUSED",
    createdAt: { $lt: Date.now() - delaySeconds },
    emailSentAt: null
  };

  persistence.Invite.find(searchParams, function(err, invites) {
    if(err) return callback(err);

    winston.info("Found " + invites.length + " pending invites to email");

    count = invites.length;
    var troupeIds = invites.map(function(i) { return i.troupeId; });
    // console.log(troupeIds);

    findByIds(troupeIds, function(err, troupes) {
      if(err) return callback(err);
      winston.info("Found " + troupes.length + " corresponding troupes for the pending invites");

      var troupesById = troupes.reduce(function(byId, troupe) { byId[troupe.id] = troupe; return byId; }, {});
      // console.dir(troupesById);

      var invite, troupe;
      for(var a = 0; a < invites.length; a++) {
        invite = invites[a];
        troupe = troupesById[invite.troupeId];
        if(!troupe) {
          winston.error('No troupe for this invite');
          continue;
        }

        emailNotificationService.sendInvite(troupe, invite.displayName, invite.email, invite.confirmationCode, invite.senderDisplayName);

        invite.emailSentAt = Date.now();
        invite.save();
      }

      callback(null, count);
    });
  });
}

function deleteAllInvitesToTroupeForUser(troupeId, userEmail, callback) {
  assert(troupeId); assert(userEmail);
  persistence.Invite.remove({ troupeId: troupeId, email: userEmail }, callback); // whether or not they are used.
}

function deleteTroupe(troupe, callback) {
  if(troupe.status != 'ACTIVE') return callback("Troupe is not active");
  if(troupe.users.length !== 1) return callback("Can only delete troupes that have a single user");

  troupe.status = 'DELETED';
  troupe.dateDeleted = new Date();
  troupe.removeUserById(troupe.users[0].userId);
  troupe.save(callback);
}

module.exports = {
  findByUri: findByUri,
  findById: findById,
  findByIds: findByIds,
  findAllTroupesForUser: findAllTroupesForUser,
  findAllTroupesIdsForUser: findAllTroupesIdsForUser,
  validateTroupeEmail: validateTroupeEmail,
  validateTroupeEmailAndReturnDistributionList: validateTroupeEmailAndReturnDistributionList,
  userHasAccessToTroupe: userHasAccessToTroupe,
  userIdHasAccessToTroupe: userIdHasAccessToTroupe,
  inviteUserToTroupe: inviteUserToTroupe,
  findInviteById: findInviteById,
  findInviteByCode: findInviteByCode,
  findMemberEmails: findMemberEmails,
  findAllUnusedInvitesForTroupe: findAllUnusedInvitesForTroupe,
  findAllUnusedInvitesForEmail: findAllUnusedInvitesForEmail,
  findAllUnusedInvitesForUserId: findAllUnusedInvitesForUserId,
  findUnusedInviteToTroupeForUserId: findUnusedInviteToTroupeForUserId,

  findOrCreateOneToOneInvite: findOrCreateOneToOneInvite,

  updateInvitesForEmailToUserId: updateInvitesForEmailToUserId,

  addRequest: addRequest,
  findRequestsByIds: findRequestsByIds,
  findAllOutstandingRequestsForTroupe: findAllOutstandingRequestsForTroupe,
  findPendingRequestForTroupe: findPendingRequestForTroupe,
  acceptRequest: acceptRequest,
  rejectRequest: rejectRequest,
  removeUserFromTroupe: removeUserFromTroupe,

  findAllUserIdsForTroupes: findAllUserIdsForTroupes,
  findUserIdsForTroupe: findUserIdsForTroupe,
  findUsersForTroupe: findUsersForTroupe,

  validateTroupeUrisForUser: validateTroupeUrisForUser,
  updateTroupeName: updateTroupeName,
  findOrCreateOneToOneTroupe: findOrCreateOneToOneTroupe,
  upgradeOneToOneTroupe: upgradeOneToOneTroupe,
  createUniqueUri: createUniqueUri,
  deleteTroupe: deleteTroupe,

  updateFavourite: updateFavourite,
  findFavouriteTroupesForUser: findFavouriteTroupesForUser,
  findBestTroupeForUser: findBestTroupeForUser,
  createNewTroupeForExistingUser: createNewTroupeForExistingUser,
  acceptInvite: acceptInvite,
  acceptInviteForAuthenticatedUser: acceptInviteForAuthenticatedUser,
  rejectInviteForAuthenticatedUser: rejectInviteForAuthenticatedUser,
  sendPendingInviteMails: sendPendingInviteMails,
  findUnusedInviteToTroupeForEmail: findUnusedInviteToTroupeForEmail
};