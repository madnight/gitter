/*jshint globalstrict:true, trailing:false */
/*global console:false, require: true, module: true */
"use strict";

var troupeService = require("../services/troupe-service"),
    _ = require("underscore"),
    restSerializer = require("../serializers/rest-serializer");

module.exports = {
    index: function(req, res, next){
      troupeService.findAllOutstandingRequestsForTroupe(req.troupe.id, function(err, requests) {
        if(err) res.send(500);
        var userIds = requests.map(function(item) { return item.userId; });

        restSerializer.serialize(userIds, restSerializer.UserIdStrategy, function(err, serialized) {
          if(err) return next(err);
          res.send(serialized);
        });

      });
    },

    "new": function(req, res){
      res.send(500);
    },

    create: function(req, res) {
      res.send(500);
    },

    show: function(req, res){
      res.send(500);
    },

    edit: function(req, res){
      res.send(500);
    },

    /* This means the user has been accepted */
    update:  function(req, res) {
      console.log(req.request);
      troupeService.acceptRequest(req.request, function(err, request) {
        if(err) return res.send(500);
        res.send(200);
      });
    },

    destroy: function(req, res) {
      console.log(req.request);
      res.send(500);
    },

    load: function(req, id, callback){
      troupeService.findPendingRequestForTroupeAndUser(req.troupe.id, id, callback);
    }

};