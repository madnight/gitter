#!/usr/bin/env node
'use strict';

var _ = require('lodash');
var shutdown = require('shutdown');
var persistence = require('gitter-web-persistence');
var mongooseUtils = require('gitter-web-persistence-utils/lib/mongoose-utils');
var onMongoConnect = require('../../server/utils/on-mongo-connect');
var through2Concurrent = require('through2-concurrent');
var orgMap = require('./org-map.json');
var userMap = require('./user-map.json');


function getGroupableRooms() {
  return persistence.Troupe.aggregate([
      {
        $match: {
          githubType: {
            // don't strip out user channels here because that's useful info
            // for the steps below
            $nin: ['ONETOONE']
          },
          lcOwner: { $exists: true, $ne: null },
          groupId: { $exists: false }
        }
      },
      {
        $project: {
          uri: 1,
          lcOwner: 1,
          githubType: 1,
          parentId: 1,
          ownerUserId: 1
        }
      },
      {
        $group: {
          _id: '$lcOwner',
          rooms: { $push: '$$CURRENT' }
        }
      }
      // TODO: project orgRoom & user for efficiency
    ])
    .read('secondaryPreferred')
    .cursor({ batchSize: 1000 })
    // Why exec() before stream() unlike every other instance of .stream() in
    // the app? Aggregate returns different cursors/reponses to find and the
    // rest.
    .exec()
    .stream();
}

function log(batch, enc, callback) {
  console.log(batch._id, batch.rooms.length);
  callback();
}

var lookups = [];
function migrate(batch, enc, callback) {
  var lcOwner = batch._id;

  // Fish the owner out of the first room's uri. This is the case-sensitive
  // version used for name and uri.
  var uniqueOwners = _.uniq(batch.rooms.map(function(room) {
    return room.uri.split('/')[0];
  }));

  if (uniqueOwners.length > 1) {
    //console.log('WARNING: MULTIPLE UNIQUE OWNERS', uniqueOwners);
    // NOTE: should this be resolved BEFORE we run this script? Should we skip
    // them?
  }

  var owner = uniqueOwners[0];

  var githubTypeMap = {};
  batch.rooms.forEach(function(room) {
    githubTypeMap[room.githubType] = true;
  });

  var hasOrgRoom = !!(githubTypeMap['ORG'] || githubTypeMap['ORG_CHANNEL']);
  var hasUserRoom = !!githubTypeMap['USER_CHANNEL'];
  var isDefinitelyOrg = !!orgMap[lcOwner];
  var isDefinitelyUser = _.any(uniqueOwners, function(o) {
    return !!userMap[o];
  })

  var result;
  if (hasOrgRoom || isDefinitelyOrg) {
    result = "YES";
  } else if (hasUserRoom || isDefinitelyUser) {
    result = "NO";
  } else {
    // TODO: maybe here we can somehow lookup owner in users again so we can do
    // a case-sensitive match?
    result = "MAYBE";
    // TODO: concat all the unique owners, not just the first one
    // IDEA: if any of the rooms is an org channel, then it must be an
    // org-based room
    // IDEA: if there is a user channel for this same lcOwner, then it cannot
    // be an org-based room
    lookups.push(owner);
  }

  console.log(
    owner,
    'rooms:'+batch.rooms.length,
    'hasOrgRoom:'+hasOrgRoom,
    'hasUserRoom:'+hasUserRoom,
    'isDefinitelyOrg:'+isDefinitelyOrg,
    'isDefinitelyUser:'+isDefinitelyUser,
    result
  );

  callback();

  // NOTE: disabling the actual upserting for now while I figure out how to
  // calculate if we need a group

  // from here on out we need result == YES, owner and lcOwner OR result = NO.
  // There shouldn't be any MAYBE anymore.

  /*
  // upsert the lcOwner into group
  var query = { lcUri: lcOwner };
  return mongooseUtils.upsert(persistence.Group, query, {
      // only set on insert because we don't want to override name or forumId
      // or anything like that
      $setOnInsert: {
        name: owner,
        uri: owner,
        lcUri: lcOwner
      }
    })
    .spread(function(group, existing) {
      // whether or not a new one was inserted we have to fill in the missing
      // groupId for the batch anyway
      var groupId = group._id;
      return persistence.Troupe.update({
          lcOwner: lcOwner,
          // strip out things that shouldn't have a group just in case
          githubType: {
            $nin: ['ONETOONE', 'USER_CHANNEL']
          },
          // only the missing ones
          groupId: { $exists: false }
        }, {
          $set: { groupId: groupId }
        })
        .exec();
    })
    .nodeify(callback);
  */
}

function run(f, callback) {
  getGroupableRooms()
    .pipe(through2Concurrent.obj({maxConcurrency: 10}, f))
    .on('data', function(batch) {
    })
    .on('end', function() {
      console.log('done!');
      callback();
    })
    .on('error', function(error) {
      callback(error);
    })
}

function done(error) {
  if (error) {
    console.error(error);
    console.error(error.stack);
    process.exit(1);
  } else {
    shutdown.shutdownGracefully();
  }
}

onMongoConnect()
  .then(function() {
    require('yargs')
      .command('dry-run', 'Dry run', { }, function() {
        run(log, done);
      })
      .command('execute', 'Execute', { }, function() {
        run(migrate, function(err) {
          console.log("numLookups: "+lookups.length);
          //console.log('==========')
          //console.log(lookups.join(','));
          done(err);
        });
      })
      .demand(1)
      .strict()
      .help('help')
      .alias('help', 'h')
      .argv;
  });
