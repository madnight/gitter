'use strict';

var favouriteFilter = require('gitter-web-shared/filters/left-menu-primary-favourite');
var favouriteOneToOneFilter = require('gitter-web-shared/filters/left-menu-primary-favourite-one2one');
var orgFavouriteFilter = require('gitter-web-shared/filters/left-menu-primary-favourite-org');
var favouriteSort = require('gitter-web-shared/sorting/left-menu-primary-favourite');
var parseToTemplateItem = require('gitter-web-shared/parse/left-menu-primary-item');

function generateLeftMenuFavouriteRoomsList(state, rooms, groupId) {
  var filter;
  switch(state) {
    //There is no filter here because you can only be in the temp org state
    //if you have not joined any rooms for a given group
    case 'search':
      filter = function() { return false; };
      break;
    case 'people':
      filter = favouriteOneToOneFilter;
      break;
    case 'org':
      filter = function(model) { return orgFavouriteFilter(model, groupId) };
      break;
    default:
      filter = favouriteFilter;
  }

  return rooms
    .filter(favouriteFilter)
    .map(function(model){
      if(!filter(model)) {
        model.isHidden = true;
      }
      return parseToTemplateItem(model, state);
    })
    .sort(favouriteSort);
}

module.exports = generateLeftMenuFavouriteRoomsList;
