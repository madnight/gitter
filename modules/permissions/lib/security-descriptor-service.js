"use strict";

var Troupe = require('gitter-web-persistence').Troupe;
var Group = require('gitter-web-persistence').Group;
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');
var assert = require('assert');
var securityDescriptorValidator = require('./security-descriptor-validator');
var StatusError = require('statuserror');
var Promise = require('bluebird');

/**
 * @private
 */
function findByIdForModel(Model, id, userId) {
  var projection = {
    _id: 0,
    'sd.type': 1,
    'sd.members': 1,
    'sd.admins': 1,
    'sd.public': 1,
    'sd.linkPath': 1,
    'sd.externalId': 1,
    'sd.internalId': 1,
  };

  if (userId) {
    // For legacy reasons, bans hang off the base object (for now)
    projection['bans'] = {
      $elemMatch: {
        userId: userId
      }
    };
    // TODO: selectively elemMath var elemMatch = { $elemMatch: { $eq: userId } };
    projection['sd.extraMembers'] = 1;
    projection['sd.extraAdmins'] = 1;
  }

  return Model.findById(id, projection, { lean: true })
    .exec()
    .then(function(doc) {
      if (!doc || !doc.sd) return null; // TODO: throw 404?
      var sd = doc.sd;
      if (doc.bans) {
        // Move the bans onto sd
        sd.bans = doc.bans;
      }
      securityDescriptorValidator(sd);
      return sd;
    });
}

function getForRoomUser(roomId, userId) {
  return findByIdForModel(Troupe, roomId, userId);
}

function getForGroupUser(groupId, userId) {
  return findByIdForModel(Group, groupId, userId);
}

/**
 * @private
 */
function insertForModel(Model, id, descriptor) {
  var sd = {
    type: descriptor.type,
    members: descriptor.members,
    admins: descriptor.admins,
    public: descriptor.public,
    linkPath: descriptor.linkPath,
    externalId: descriptor.externalId,
    internalId: mongoUtils.asObjectID(descriptor.internalId),
  };

  var setOperation = {
    $set: {
      sd: sd
    }
  };

  securityDescriptorValidator(descriptor);

  // if (descriptor.bans && descriptor.bans.length) {
  //   setOperation.$setOnInsert.bans = mongoUtils.asObjectIDS(descriptor.extraMembers);
  // }

  if (descriptor.extraMembers && descriptor.extraMembers.length) {
    sd.extraMembers = mongoUtils.asObjectIDs(descriptor.extraMembers);
  }

  if (descriptor.extraAdmins && descriptor.extraAdmins.length) {
    sd.extraAdmins = mongoUtils.asObjectIDs(descriptor.extraAdmins);
  }

  var query = {
    _id: mongoUtils.asObjectID(id),
    sd: { $exists: false }
  };

  return Model.update(query, setOperation)
    .exec()
    .then(function(result) {
      return result.nModified > 0;
    });
}

/**
 * Returns true if an existing descriptor was updated
 */
function insertForRoom(roomId, descriptor) {
  return insertForModel(Troupe, roomId, descriptor);
}

function insertForGroup(groupId, descriptor) {
  return insertForModel(Group, groupId, descriptor);
}

function updateLinksForRepo(linkPath, newLinkPath, externalId) {
  assert(linkPath, 'linkPath expected');
  assert(newLinkPath, 'newLinkPath expected');

  var parts = newLinkPath.split('/');
  if (parts.length !== 2) {
    throw new StatusError(400, 'Invalid linkPath attribute');
  }

  if (!parts[0].length || !parts[1].length) {
    throw new StatusError(400, 'Invalid linkPath attribute: ' + linkPath);
  }

  var query = {
    'sd.type': 'GH_REPO',
    'sd.linkPath': linkPath
  };

  var update = {
    $set: {
      'sd.linkPath': newLinkPath
    }
  };

  if (externalId) {
    update.$set['sd.externalId'] = externalId;
  }

  return Promise.join(
    Troupe.update(query, update, { multi: true }).exec(),
    Group.update(query, update, { multi: true }).exec());

  // TODO: consider sending live-collection updates
}

function updatePublicFlagForRepo(linkPath, isPublic) {
  assert(linkPath, 'linkPath expected');
  assert(isPublic === true || isPublic === false, 'isPublic must be a boolean');

  var query = {
    'sd.type': 'GH_REPO',
    'sd.linkPath': linkPath
  };

  var update = {
    $set: {
      'sd.public': isPublic
    }
  };

  return Promise.join(
    Troupe.update(query, update, { multi: true }).exec(),
    Group.update(query, update, { multi: true }).exec());

  // TODO: consider sending live-collection updates
}

function getUsedLinkPathsForModel(Model, type, linkPaths) {
  var query = {
    'sd.type': type,
    'sd.linkPath': {
      $in: linkPaths
    }
  };
  return Model.distinct('sd.linkPath', query).exec();
}

function getUsedLinkPaths(type, linkPaths) {
  return Promise.join(
    getUsedLinkPathsForModel(Group, type, linkPaths),
    getUsedLinkPathsForModel(Troupe, type, linkPaths),
    function(groups, repos) {
      return groups.concat(repos)
        .reduce(function(map, linkPath) {
          map[linkPath] = true;
          return map;
        }, {});
    });
}

module.exports = {
  getForRoomUser: getForRoomUser,
  getForGroupUser: getForGroupUser,
  insertForRoom: insertForRoom,
  insertForGroup: insertForGroup,
  updateLinksForRepo: updateLinksForRepo,
  updatePublicFlagForRepo: updatePublicFlagForRepo,
  getUsedLinkPaths: getUsedLinkPaths
};