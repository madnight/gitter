"use strict";

var mongoose      = require('../../utils/mongoose-q');
var Schema        = mongoose.Schema;
var ObjectId      = Schema.ObjectId;
var winston        = require('../../utils/winston');
var assert         = require("assert");
var Q              = require('q');
var restSerializer = require('../../serializers/rest-serializer');
var appEvents      = require("../../app-events");
var _              = require("underscore");


function serializeEvent(url, operation, model, callback) {
  winston.verbose("Serializing " + operation + " to " + url);

  return restSerializer.serializeModel(model)
    .then(function(serializedModel) {
      appEvents.dataChange2(url, operation, serializedModel);
    })
    .fail(function(err) {
      winston.error("Silently failing model event: ", { exception: err, url: url, operation: operation });
    })
    .nodeify(callback);
}

function serializeOneToOneTroupeEvent(userId, operation, model, callback) {
  var oneToOneUserUrl = '/user/' + userId + '/rooms';

  var strategy = new restSerializer.TroupeStrategy({ currentUserId: userId });

  return restSerializer.serialize(model, strategy)
    .then(function(serializedModel) {
      appEvents.dataChange2(oneToOneUserUrl, operation, serializedModel);
    })
    .nodeify(callback);
}

module.exports = {
  install: function(mongooseConnection) {

    //
    // User in a Troupe
    //
    var TroupeUserSchema = new Schema({
      userId: { type: ObjectId },
      deactivated: { type: Boolean },
      lurk: { type: Boolean },
      /** Lurk settings
        *  false, undefined: no lurking
        *  true: lurking
        */
    });
    TroupeUserSchema.schemaTypeName = 'TroupeUserSchema';

    var TroupeBannedUserSchema = new Schema({
      userId: { type: ObjectId },
      dateBanned: { type: Date, "default": Date.now },
      bannedBy: { type: ObjectId }
    });
    TroupeBannedUserSchema.schemaTypeName = 'TroupeBannedUserSchema';
    //
    // A Troupe
    //
    var TroupeSchema = new Schema({
      name: { type: String },
      topic: { type: String, 'default':'' },
      uri: { type: String },
      tags: [String],
      lcUri: { type: String, 'default': function() { return this.uri ? this.uri.toLowerCase() : null; }  },
      githubType: { type: String, 'enum': ['REPO', 'ORG', 'ONETOONE', 'REPO_CHANNEL', 'ORG_CHANNEL', 'USER_CHANNEL'], required: true },
      status: { type: String, "enum": ['ACTIVE', 'DELETED'], "default": 'ACTIVE'},
      oneToOne: { type: Boolean, "default": false },
      users: [TroupeUserSchema],
      bans: [TroupeBannedUserSchema],
      parentId: { type: ObjectId, required: false },
      ownerUserId: { type: ObjectId, required: false }, // For channels under a user /suprememoocow/custom
      security: { type: String, /* WARNING: validation bug in mongo 'enum': ['PRIVATE', 'PUBLIC', 'INHERITED'], required: false */ }, // For REPO_CHANNEL, ORG_CHANNEL, USER_CHANNEL
      dateDeleted: { type: Date },
      dateLastSecurityCheck: { type: Date },
      noindex: { type: Boolean, 'default': false},
      tags: { type: Array },
      _nonce: { type: Number },
      _tv: { type: 'MongooseNumber', 'default': 0 }
    });
    TroupeSchema.schemaTypeName = 'TroupeSchema';

    TroupeSchema.path('security').validate(function (value) {
      return !value || value === 'PRIVATE' || value === 'PUBLIC' || value === 'INHERITED';
    }, 'Invalid security');

    // Ideally we should never search against URI, only lcURI
    TroupeSchema.index({ uri: 1 }, { unique: true, sparse: true });
    TroupeSchema.index({ lcUri: 1 }, { unique: true, sparse: true });
    TroupeSchema.index({ parentId: 1 });
    TroupeSchema.index({ ownerUserId: 1 });
    TroupeSchema.index({ "users.userId": 1 });
    TroupeSchema.index({ "users.userId": 1,  "users.deactivated": 2 });
    TroupeSchema.pre('save', function (next) {
      this.lcUri =  this.uri ? this.uri.toLowerCase() : null;
      next();
    });

    TroupeSchema.methods.getUserIds = function() {
      return this.users.map(function(troupeUser) { return troupeUser.userId; });
    };

    TroupeSchema.methods.findTroupeUser = function(userId) {
      var user = _.find(this.users, function(troupeUser) {
        return "" + troupeUser.userId == "" + userId;
      });

      return user;
    };


    TroupeSchema.methods.containsUserId = function(userId) {
      return !!this.findTroupeUser(userId);
    };

    TroupeSchema.methods.getOtherOneToOneUserId = function(knownUserId) {
      assert(this.oneToOne, 'getOtherOneToOneUserId should only be called on oneToOne troupes');
      assert(knownUserId, 'knownUserId required');

      var troupeUser = _.find(this.users, function(troupeUser) {
        return "" + troupeUser.userId != "" + knownUserId;
      });

      return troupeUser && troupeUser.userId;
    };

    TroupeSchema.methods.addUserBan = function(options) {
      // TODO: add some asserts here
      var ban = new TroupeBannedUser(options);
      this.bans.push(ban);
      return ban;
    };

    TroupeSchema.methods.addUserById = function(userId, options) {
      assert(!this.oneToOne);

      var exists = this.users.some(function(user) { return user.userId == userId; });
      if(exists) {
        throw new Error("User already exists in this troupe.");
      }

      var raw = { userId: userId };
      if(options && 'lurk' in options) {
        raw.lurk = options.lurk;
      }

      // TODO: disable this methods for one-to-one troupes
      var troupeUser = new TroupeUser(raw);
      this.post('save', function(postNext) {
        var url = "/rooms/" + this.id + "/users";
        var userUrl = "/user/" + userId + "/rooms";

        Q.all([
          serializeEvent(url, "create", troupeUser),
          serializeEvent(userUrl, "create", this)
          ])
          .nodeify(postNext);
      });

      return this.users.push(troupeUser);
    };

    TroupeSchema.methods.removeUserById = function(userId) {
      assert(userId);

      winston.verbose("Troupe.removeUserById", { userId: userId, troupeId: this.id });

      // TODO: disable this methods for one-to-one troupes
      var troupeUser = _.find(this.users, function(troupeUser){ return troupeUser.userId == userId; });

      if(troupeUser) {
        // TODO: unfortunately the TroupeUser middleware remove isn't being called as we may have expected.....
        this.post('save', function(postNext) {
          var promise;

          if(!this.oneToOne) {
            /* Dont mark the user as having been removed from the room */
            var url = "/rooms/" + this.id + "/users";
            var userUrl = "/user/" + userId + "/rooms";

            promise = Q.all([
              serializeEvent(url, "remove", troupeUser),
              serializeEvent(userUrl, "remove", this)
            ]);

            // TODO: move this in a remove listener somewhere else in the codebase
            appEvents.userRemovedFromTroupe({ troupeId: this.id, userId: troupeUser.userId });
          } else {
            promise = serializeOneToOneTroupeEvent(userId, "remove", this);
          }

          return promise.nodeify(postNext);
        });

        if(this.oneToOne) {
          troupeUser.deactivated = true;
        } else {
          troupeUser.remove();
        }

      } else {
        winston.warn("Troupe.removeUserById: User " + userId + " not in troupe " + this.id);
      }
    };

    TroupeSchema.methods.reactivateUserById = function(userId) {
      assert(userId);
      assert(this.oneToOne);

      winston.verbose("Troupe.reactivateUserById", { userId: userId, troupeId: this.id });

      // TODO: disable this methods for one-to-one troupes
      var troupeUser = _.find(this.users, function(troupeUser){ return troupeUser.userId == userId; });

      if(troupeUser) {
        // TODO: unfortunately the TroupeUser middleware remove isn't being called as we may have expected.....
        this.post('save', function(postNext) {
          serializeOneToOneTroupeEvent(userId, "create", this, postNext);
        });

        troupeUser.deactivated = undefined;
      } else {
        winston.warn("Troupe.reactivateUserById: User " + userId + " not in troupe " + this.id);
      }
    };

    var Troupe = mongooseConnection.model('Troupe', TroupeSchema);
    var TroupeUser = mongooseConnection.model('TroupeUser', TroupeUserSchema);
    var TroupeBannedUser = mongooseConnection.model('TroupeBannedUser', TroupeBannedUserSchema);

    return {
      model: Troupe,
      schema: TroupeSchema
    };
  }
};
