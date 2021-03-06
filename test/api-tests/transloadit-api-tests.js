"use strict";

process.env.DISABLE_API_LISTEN = '1';

var env = require('gitter-web-env');
var nconf = env.config;
var Promise = require('bluebird');
var assert = require('assert');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var groupService = require('gitter-web-groups/lib/group-service');


describe('transloadit-api-tests', function() {

describe('integration tests #slow', function() {
  var app, request;

  fixtureLoader.ensureIntegrationEnvironment(
      'transloadit:avatars:bucket',
      'transloadit:template_avatar_id',
      'transloadit:template_image_id',
      'transloadit:template_id');

  before(function() {
    request = require("supertest-as-promised")(Promise);
    app = require('../../server/api');
  });

  var fixture = fixtureLoader.setup({
    user1: {
      accessToken: 'web-internal'
    },
    group1: {
      securityDescriptor: {
        extraAdmins: ['user1']
      }
    },
    troupe1: {
      security: 'PUBLIC',
      group: 'group1'
    }
  });

  it('GET /private/generate-signature (group avatar)', function() {
    var transloaditUrl = 'https://' + nconf.get('transloadit:avatars:bucket') + '.s3.amazonaws.com/groups/' + fixture.group1.id + '/original';

    return request(app)
      .get('/private/generate-signature')
      .query({
        type: 'avatar',
        group_id: fixture.group1.id
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var params = JSON.parse(result.body.params);

        // test that type avatar became the correct template_id
        assert.strictEqual(params.template_id, nconf.get('transloadit:template_avatar_id'));

        // check that we went down the groups code path
        var originalPath = 'groups/' + fixture.group1.id + '/original';
        var thumbsPath = 'groups/' + fixture.group1.id + '/${file.meta.width}';
        assert.strictEqual(params.steps.export_original.path, originalPath);
        assert.strictEqual(params.steps.export_thumbs.path, thumbsPath);

        // manually hit the notify url, impersonating tranloadit
        var apiBasePath = nconf.get('web:apiBasePath');
        var notifyUrl = params.notify_url.replace(apiBasePath, '');
        return request(app)
          .post(notifyUrl)
          .send({
            transloadit: JSON.stringify({
              ok: 'ASSEMBLY_COMPLETED',
              results: {
                ':original': [{
                  ssl_url: transloaditUrl
                }]
              }
            })
          })
          .expect(200);
      })
      .then(function() {
        // load the group again so we can see if the url changed
        return groupService.findById(fixture.group1.id);
      })
      .then(function(group) {
        assert.strictEqual(group.avatarUrl, transloaditUrl);
        assert.strictEqual(group.avatarVersion, 1);
      });
  });

  it('GET /private/generate-signature (room image)', function() {
    return request(app)
      .get('/private/generate-signature')
      .query({
        type: 'image',
        room_uri: fixture.troupe1.uri,
        room_id: fixture.troupe1.id
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var params = JSON.parse(result.body.params);

        // test that type image became the correct template_id
        assert.strictEqual(params.template_id, nconf.get('transloadit:template_image_id'));

        // test that we set a random token..
        assert.ok(params.fields.token);

        // these don't change for rooms, but at least checking them means we
        // went down the right path
        var originalPath = '${fields.room_uri}/${fields.token}/${file.url_name}';
        var thumbsPath = '${fields.room_uri}/${fields.token}/thumb/${file.url_name}';
        assert.strictEqual(params.steps.export_originals.path, originalPath);
        assert.strictEqual(params.steps.export_thumbs.path, thumbsPath);
      });
  });
});

});
