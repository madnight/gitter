'use strict';

var Backbone = require('backbone');
var dragula  = require('dragula');
var _        = require('underscore');

var DNDCtrl = function(attrs) {

  if (!attrs || !attrs.model) {
    throw new Error('A valid model must be passed to a new instance of the DNDController');
  }

  this.model = attrs.model;
  this.onMouseUp = this.onMouseUp.bind(this);

  this.drag = dragula([], {
    moves:   this.shouldItemMove.bind(this),
  });

  this.drag.on('dragend', this.onDragEnd.bind(this));
  this.drag.on('cancel',  this.onCancel.bind(this));
  this.drag.on('remove',  this.onDragEnd.bind(this));
  this.drag.on('drag',    this.onDragStart.bind(this));
  this.drag.on('drop',    this.onItemDropped.bind(this));
  this.drag.on('over',    this.onContainerHover.bind(this));

};

DNDCtrl.prototype = _.extend(DNDCtrl.prototype, Backbone.Events, {

  shouldItemMove: function (el) {
    return (el.tagName  !== 'A' &&
            !el.classList.contains('search-message-empty-container') &&
            el.id !== 'empty-view');
  },

  pushContainer: function (el) {
    this.drag.containers.push(el);
  },

  //TODO TEST THIS
  removeContainer: function (el) {
    var index = this.drag.containers.indexOf(el);
    if (index === -1) { return; }

    this.drag.containers.splice(index, 1);
  },

  onItemDropped: function(el, target, source, sibling) {//jshint unused: true
    //guard against no drop target
    if (!target || !target.dataset) { return; }
    if (this.model.get('state') !== 'favourite' &&
        target.dataset.stateChange === 'favourite') {
      this.trigger('room-menu:add-favourite', el.dataset.id);
      this.onDragEnd();
    } else if (target.classList.contains('collection-list--primary')) {
      this.trigger('room-menu:remove-favourite', el.dataset.id);
      this.onDragEnd();
    } else {
      var siblingID = !!sibling && sibling.dataset.id;
      this.trigger('room-menu:sort-favourite', el.dataset.id, siblingID);
      this.onDragEnd();
    }

  },

  onDragStart: function () {
    this.mirror = document.querySelector('gu-mirror');
    this.trigger('dnd:start-drag');
    window.addEventListener('mouseup', this.onMouseUp);
  },

  onDragEnd: function () {
    this.mirror = null;
    window.removeEventListener('mouseup', this.onMouseUp);
    this.trigger('dnd:end-drag');
  },

  onCancel: function (el, container, source){
    //If an el is dropped at the beginning or end of the list and it was already at that position
    //a cancel event is fired. In that case we need to ensure we add in the first/last position
    var position;
    var containerFirstChild = container.children[0];
    if(!!containerFirstChild && containerFirstChild.classList.contains('gu-transit')) {
      position = 'first';
    }

    if(!position) {
      var containerLastChild = container.children[container.children.length - 1];
      if(!!containerLastChild && containerLastChild.classList.contains('gui-transit')) {
        position = 'last';
      }
    }

    if(container.classList.contains('collection-list--favourite') &&  container === source) {
      this.trigger('room-menu:sort-favourite', el.dataset.id, null, position);
    }
  },

  onMouseUp: function () {
    this.onDragEnd();
  },

  onContainerHover: function (el, container) { //jshint unused: true
    var mirror;
    var transit;

    //If we hover over the favourite collection hide the drag mirror
    if (container.classList.contains('collection-list--favourite')) {
      mirror  = document.querySelector('.gu-mirror');
      transit = document.querySelector('.gu-transit');
      if (mirror) { mirror.classList.add('hidden'); }
      if(transit) { transit.classList.remove('hidden'); }
    }

    //If we hover over the primary collection show the drag mirror
    else if (container.classList.contains('collection-list--primary')) {
      mirror  = document.querySelector('.gu-mirror');
      transit = document.querySelector('.gu-transit');
      if (mirror) { mirror.classList.remove('hidden'); }
      if(transit) { transit.classList.add('hidden'); }
    }
  },

});

module.exports = DNDCtrl;
