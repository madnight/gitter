import getContext from '../utils/context';
import Backbone from 'backbone';
import _ from 'lodash';
import {subscribe, unsubscribe} from '../../../shared/dispatcher';
import SimpleFilteredCollection from 'gitter-realtime-client/lib/simple-filtered-collection';

import LiveCollection from './live-collection';
import {BaseModel} from './base-model';

import apiClient from '../utils/api-client';
import {getRealtimeClient} from './realtime-client';
import parseTopic from '../../../shared/parse/topic';
import parseTag from '../../../shared/parse/tag';
import {getForumId } from './forum-store';
import { getForumCategoryStore } from './forum-category-store';
import router from '../routers';
import {getCurrentUser} from '../stores/current-user-store';

import dispatchOnChangeMixin from './mixins/dispatch-on-change';
import onReactionsUpdateMixin from './mixins/on-reactions-update';


import {SUBMIT_NEW_TOPIC, TOPIC_CREATED} from '../../../shared/constants/create-topic';
import {DEFAULT_CATEGORY_NAME, DEFAULT_TAG_NAME, DEFAULT_FILTER_NAME} from '../../../shared/constants/navigation';
import {FILTER_BY_TOPIC} from '../../../shared/constants/forum-filters';
import {MOST_REPLY_SORT, MOST_LIKES_SORT} from '../../../shared/constants/forum-sorts';
import {MOST_WATCHERS_SORT} from '../../../shared/constants/forum-sorts';
import {
  UPDATE_TOPIC_SUBSCRIPTION_STATE,
  REQUEST_UPDATE_TOPIC_SUBSCRIPTION_STATE,
  SUBSCRIPTION_STATE_PENDING,
  UPDATE_TOPIC_REACTIONS
} from '../../../shared/constants/forum.js';

import {
  TITLE_UPDATE,
  BODY_UPDATE,
  CATEGORY_UPDATE,
  TAGS_UPDATE,
} from '../../../shared/constants/create-topic';

import {
  UPDATE_TOPIC,
  UPDATE_TOPIC_TITLE,
  UPDATE_TOPIC_CATEGORY,
  UPDATE_CANCEL_TOPIC,
  UPDATE_SAVE_TOPIC,
  DELETE_TOPIC,
  UPDATE_TOPIC_IS_EDITING
} from '../../../shared/constants/topic';

import {MODEL_STATE_DRAFT, MODEL_STATE_SYNCED} from '../../../shared/constants/model-states';

const modelDefaults = {
  title: '',
  //We must use undefined here as a default
  //if we do not when you edit a topic you get a blank editor
  //this is beacuse blank text is valid
  text: undefined,
  categoryId: '',
  tags: []
};


export const TopicModel = BaseModel.extend({

  // Theres a problem with the realtime client here. When a message comes in from
  // the realtime connection it will create a new model and patch the values onto an existing model.
  // If you have any defaults the patch model with override the current models values with the defaults.
  // Bad Times.
  //
  // via @cutandpastey, https://github.com/troupe/gitter-webapp/pull/2293#discussion_r81304415
  defaults: {
    state: MODEL_STATE_DRAFT,
    isEditing: false
  },

  initialize(attrs = {}){
    //If the model is initialized by the application it will be in a draft state
    //In this case we need to setup listeners for the createTopic modal events
    //which will update the draft content
    if(this.get('state') === MODEL_STATE_DRAFT || attrs.state === MODEL_STATE_DRAFT) {
      this.listenToDraftUpdates();
    }

    //When this model is saved/edited we need to clear out all listeners and
    //add any newly appropriate ones like updating content etc
    this.listenTo(this, 'change:state', this.onChangeState, this);
  },


  //Listen out for any events that will update the model through UI actions
  //Typically found in the create-topic-modal used to make new topics
  listenToDraftUpdates(){
    subscribe(TITLE_UPDATE, this.onTitleUpdate, this);
    subscribe(BODY_UPDATE, this.onBodyTextUpdate, this);
    subscribe(CATEGORY_UPDATE, this.onCategoryUpdate, this);
    subscribe(TAGS_UPDATE, this.onTagsUpdate, this);
    subscribe(SUBMIT_NEW_TOPIC, this.onRequestSave, this);
  },

  //When we change state, mainly through saving the model we need to
  //clear out all the listeners that update a given model this means
  //you can craete new topics without updating the wrong model as that would be silly...
  clearSystemListeners(){
    unsubscribe(TITLE_UPDATE, this.onTitleUpdate, this);
    unsubscribe(BODY_UPDATE, this.onBodyTextUpdate, this);
    unsubscribe(CATEGORY_UPDATE, this.onCategoryUpdate, this);
    unsubscribe(TAGS_UPDATE, this.onTagsUpdate, this);
    unsubscribe(SUBMIT_NEW_TOPIC, this.onRequestSave, this);
  },

  //TODO, quite frankly and at myslef, this is stupid. <-- @cutandpastey
  //TODO Remove ALL listeners from models and ONLY have the operations take
  //place in the parent collection.
  onChangeState(){
    this.clearSystemListeners();
    //Initialize any draft listeners such that we can update the draft model
    switch(this.get('state')) {
      case MODEL_STATE_DRAFT: return this.listenToDraftUpdates();
    }
  },

  //Update the models title when a user updates it through the UI
  onTitleUpdate({ title }){
    this.set('title', title);
  },

  //Update the models body
  onBodyTextUpdate({body}){
    this.set('text', body);
  },

  //Change category
  onCategoryUpdate({categoryId}){
    this.set('categoryId', categoryId);
  },

  //Add/Remove tags
  onTagsUpdate({ tag, isAdding }) {
    const currentTags = this.get('tags') || [];
    let newTags = currentTags;
    // Adding
    if(isAdding && currentTags.indexOf(tag) === -1) {
      newTags = currentTags.concat(tag);
    }
    // Removing
    else if(!isAdding && currentTags.indexOf(tag) !== -1) {
      newTags = currentTags.filter((currentTag) => {
        return currentTag !== tag;
      })
    }

    this.set('tags', newTags);
  },

  onRequestSave() {
    //When we have saved back to the server then we need to change route
    //we do this here by triggering this event
    this.listenTo(this, 'sync', function(){
      this.trigger(TOPIC_CREATED, this.get('id'), this.get('slug'));
    });

    //Save the model back to the server
    this.save();
  },

  //The API endpoints used to save and update the model
  //we know we have not previously saved a model if we have no idea
  //so we derive a different url respectively
  url(){
    return this.get('id') ?
    `/v1/forums/${getForumId()}/topics/${this.get('id')}`:
    `/v1/forums/${getForumId()}/topics`;
  },

  validate(attributes){
    let errors = new Map();

    if(!attributes.title || attributes.title.trim().length === 0) {
      errors.set('title', 'A new Topic requires a title');
    }
    if((attributes.editedTitle !== null && attributes.editedTitle !== undefined) && attributes.editedTitle.trim().length === 0) {
      errors.set('editedTitle', 'A Topic requires a title');
    }

    //Only check the text attribute if we are in a draft state
    //Otherwise we are probably getting something back from the server
    //and we certainly dont want the text attribute in that case
    if(attributes.state === MODEL_STATE_DRAFT && (!attributes.text || !attributes.text.length)) {
      errors.set('text', 'A new Topic requires content');
    }

    //If we are editing a topic we have a category
    //If we are creating a new one we need a categoryId
    if(!attributes.category && (!attributes.categoryId || !attributes.categoryId.length)) {
      errors.set('categoryId', 'A new Topic must have a category');
    }

    return errors.size ? errors : undefined;
  },

  toPOJO() {
    var data = this.attributes;
    data.tags = (data.tags || []);

    return Object.assign({}, modelDefaults, data, {
      tags: data.tags.map(parseTag),
      validationError: this.validationError
    });
  },

  //Used when saving as we have to clean tags that have been parsed
  getDataToSave(){
    const data = this.toPOJO();
    const tags = (data.tags || []);
    const parsedTags = tags.map((t) => t.value);

    return Object.assign({}, data, {
      tags: parsedTags
    });
  },

  parse(attrs){
    return Object.assign({}, attrs, {
      //When we have received data from the server we can assume
      //that it is no longer a draft or has been edited
      state: MODEL_STATE_SYNCED,
      text: null,
      editedTitle: null,
      editedCategory: null
    });
  }

});

export const TopicsLiveCollection = LiveCollection.extend({

  model: TopicModel,
  client: getRealtimeClient(),
  urlTemplate: '/v1/forums/:forumId/topics',

  getContextModel(){
    return new Backbone.Model({
      forumId: getForumId()
    });
  },

  initialize(models, options){
    subscribe(UPDATE_TOPIC, this.onTopicUpdate, this);
    subscribe(UPDATE_TOPIC_TITLE, this.onTopicTitleUpdate, this);
    subscribe(UPDATE_TOPIC_CATEGORY, this.onTopicCategoryUpdate, this);
    subscribe(UPDATE_CANCEL_TOPIC, this.onTopicEditCancel, this);
    subscribe(UPDATE_SAVE_TOPIC, this.onTopicEditSaved, this);
    subscribe(DELETE_TOPIC, this.onTopicDelete, this);
    subscribe(UPDATE_TOPIC_IS_EDITING, this.onTopicIsEditingUpdate, this);
    this.listenTo(router, 'change:createTopic', this.onCreateTopicChange, this);

    this.snapshotFilter = options.snapshotFilter;
    this.snapshotSort = options.snapshotSort;

    subscribe(UPDATE_TOPIC_REACTIONS, this.onReactionsUpdate, this);
  },

  //The default case for snapshots is to completely reset the collection
  //to a safe server state. As we hold draft topics in the collection this
  //is problematic. Here, we need to grab the draft model and re-add it once
  //the snapshot has been handled. It would be much nicer to be able to pass remove: false
  //to this function to avoid this
  handleSnapshot(){
    const draftModel = this.findWhere({ state: MODEL_STATE_DRAFT });
    LiveCollection.prototype.handleSnapshot.apply(this, arguments);
    if(!draftModel) { return; }
    this.add(draftModel);
  },

  //When a user updates the content of a pre-existing topic then update here
  //TODO we should put the model in a "edited" state and allow it to update itself
  onTopicUpdate({text}) {
    const topicId = router.get('topicId');
    const model = this.get(topicId);
    if(!model) { return; }
    model.set('text', text);
  },
  onTopicTitleUpdate({title}) {
    const topicId = router.get('topicId');
    const model = this.get(topicId);
    if(!model) { return; }
    model.set('editedTitle', title);
  },

  onTopicCategoryUpdate({ categoryId }) {
    const topicId = router.get('topicId');
    const model = this.get(topicId);
    if(!model) { return; }
    const forumCategoryStore = getForumCategoryStore();
    const newCategory = forumCategoryStore.getById(categoryId);
    model.set('editedCategory', newCategory);
  },

  getSnapshotState() {
    return {
      filter: this.snapshotFilter,
      sort: this.snapshotSort
    }
  },

  setSnapshotFilter(filter) {
    this.snapshotFilter = filter;
  },

  setSnapshotSort(sort) {
    this.snapshotSort = sort;
  },

  //If a user presses the cancel button reset the text
  //this will cause body.html to be displayed
  //TODO we should reset the models state to synced here
  onTopicEditCancel(){
    const topicId = router.get('topicId');
    const model = this.get(topicId);
    if(!model) { return; }
    model.set({
      editedTitle: null,
      editedCategory: null,
      text: null,
      isEditing: false
    });
  },

  //When a user clicks save on the editor we must save it back to the server
  //TODO we should migrate this up into the model itself
  onTopicEditSaved(){
    const topicId = router.get('topicId');
    const model = this.get(topicId);
    if(!model) { return; }

    const category = model.get('editedCategory');
    const title = model.get('editedTitle');
    const text = model.get('text');
    let dataToSave = {};
    if(category) {
      dataToSave.categoryId = category.id;
    }
    if(title || title === '') {
      dataToSave.title = title.trim();
    }
    if(text || text === '') {
      dataToSave.text = text;
    }

    model.save(dataToSave, { patch: true });
    if(!model.validationError) {
      model.set({
        isEditing: false
      });
    }
  },

  onTopicDelete() {
    const topicId = router.get('topicId');
    const model = this.get(topicId);
    if(!model) { return; }
    model.destroy();
  },

  onTopicIsEditingUpdate({ isEditing }) {
    const topicId = router.get('topicId');
    const model = this.get(topicId);
    if(!model) { return; }

    model.set({
      isEditing
    });
  },

  //If a user visits or returns from /create-topic we must either:
  //1, create a new draft model
  //2, remove a draft model from the collection
  onCreateTopicChange(){
    const isCreatingTopic = router.get('createTopic');
    if(isCreatingTopic) { return this.addNewDraftItem(); }
    return this.removeDraftItems();
  },

  //Add a draft model
  addNewDraftItem(){
    const model = new TopicModel({ state: MODEL_STATE_DRAFT });
    this.add(model);
  },

  //Remove a draft model
  removeDraftItems(){
    const models = this.filter((model) => model.get('state') === MODEL_STATE_DRAFT);
    //TODO Remove this when events get moved into here
    models.forEach((model) => model.clearSystemListeners());
    this.remove(models);
  }

});

function tagMatches(model, tag) {
  const tags = (model.get('tags') || []);
  return tags.some((t) => t === tag);
}

function userMatches(model, user) {
  return model.get('user').username === user.username;
}

function categoryMatches(model, slug) {
  const category = (model.get('category') || {});
  return category.slug === slug;
}

// TODO: we should really get rid of special values that just mean empty or
// none or don't filter/sort by this thing. It is error-prone,
// infects/complicates all the code and means that adding a category called
// "all" or a tag called "all-tags" will just break everything. Also "filtering
// by activity" currently means "don't filter at all"
function desentinel(value, sentinel) {
  return (value === sentinel) ? undefined : value;
}

onReactionsUpdateMixin(TopicsLiveCollection, 'onReactionsUpdate');

export class TopicsStore {

  constructor(models, options) {
    //Get access to listenTo etc
    _.extend(this, Backbone.Events);

    // Passing in the snapshot filter & sort as options to the live collection
    // so it can be there when the connection first gets established. This also
    // means that the router MUST have already parsed the url parameters and
    // initialised the correct initial state by this point.
    const topicCollectionOptions = _.extend({
      snapshotFilter: this.getSnapshotFilter(),
      snapshotSort: this.getSnapshotSort()
    }, options);
    this.topicCollection = new TopicsLiveCollection(models, topicCollectionOptions);

    //This filtered collection will allow us to filter out any models based on the url state
    this.collection = new SimpleFilteredCollection([], {
      collection: this.topicCollection,
      filter: this.getFilter(),
      comparator: (a, b) => {
        // NOTE: this logic has to be kept in sync with the backend, otherwise
        // there will be crappy bugs all over the place.
        const sort = router.get('sortName');

        // At the time of writing you can only sort by number of replies,
        // number of likes, latest first or (not used by the client) most
        // recently updated on the server.

        if (sort === MOST_REPLY_SORT) {
          const repliesDiff = (b.get('repliesTotal') - a.get('repliesTotal'));
          if (repliesDiff !== 0) return repliesDiff;
        }

        if (sort === MOST_LIKES_SORT) {
          const aLikes = (a.get('reactions') || {}).like || 0;
          const bLikes = (b.get('reactions') || {}).like || 0;
          const likesDiff = (bLikes - aLikes);
          if (likesDiff !== 0) return likesDiff;
        }

        // assume most recent by default, by also as a secondary sort key
        /*
        NOTE: The server sorts by id as a proxy for sent, so use the same field
        to match the server's behavior exactly and also so we don't have to
        unnecessarily create date fields.
        */
        const bid = b.get('id');
        const aid = a.get('id');
        if (aid && bid) {
          if (bid > aid) {
            return 1;
          } else if (bid < aid) {
            return -1;
          } else {
            return 0;
          }
        }

        // fall back to sent if something doesn't have an id yet
        return new Date(b.get('sent')) - new Date(a.get('sent')) ;
      }
    });

    this.listenTo(router, 'change:categoryName change:tagName change:filterName', this.onRouterUpdate, this);
    this.listenTo(router, 'change:sortName', this.onSortUpdate, this);

    //Proxy events from the filtered collection
    this.listenTo(this.collection, 'all', (type, collection, val) => {
      this.trigger(type, collection, val);
    });

    //Proxy up events from a draft model that is being updated
    this.listenTo(this.topicCollection, 'change:title', (model, val, options) => {
      this.trigger('change:title', model, val, options);
    });

    this.listenTo(this.topicCollection, 'change:text', (model, val, options) => {
      this.trigger('change:text', model, val, options);
    });

    this.listenTo(this.topicCollection, 'change:categoryId', (model, val, options) => {
      this.trigger('change:categoryId', model, val, options);
    });

    this.listenTo(this.topicCollection, 'change:tags', (model, val, options) => {
      this.trigger('change:tags', model, val, options);
    });

    this.listenTo(this.topicCollection, 'invalid', (model, val, options) => {
      this.trigger('invalid', model, val, options);
    });


    //TODO figure out why we need to call a filter here
    //I think this is due to a race condition, manually calling here fixes this
    //but it is less than ideal
    this.listenTo(this.topicCollection, TOPIC_CREATED, (topicId, slug) => {
      this.collection.setFilter(this.getFilter());
      this.trigger(TOPIC_CREATED, topicId, slug);
    });

    subscribe(REQUEST_UPDATE_TOPIC_SUBSCRIPTION_STATE, this.onRequestSubscriptionStateUpdate, this);
    subscribe(UPDATE_TOPIC_SUBSCRIPTION_STATE, this.onSubscriptionStateUpdate, this);
  }

  getFilter() {
    const currentUser = getCurrentUser();

    const categorySlug = desentinel(router.get('categoryName'), DEFAULT_CATEGORY_NAME);
    const tagName = desentinel(router.get('tagName'), DEFAULT_TAG_NAME);
    // activity (which means all at the moment) or my-topics for now
    const filterName = desentinel(router.get('filterName'), DEFAULT_FILTER_NAME);

    // We must return a new function here to avoid caching issues within simpleFilteredCollection
    return function(model) {
      // Never show draft models
      if (model.get('state') === MODEL_STATE_DRAFT) return false;

      if (categorySlug && !categoryMatches(model, categorySlug)) return false;

      if (tagName && !tagMatches(model, tagName)) return false;

      // NOTE: FILTER_BY_TOPIC means "my topics"
      if (filterName === FILTER_BY_TOPIC && !userMatches(model, currentUser)) return false;

      return true;
    }
  }

  // The snapshot options take json style simple objects
  getSnapshotFilter() {
    const filterName = desentinel(router.get('filterName'), DEFAULT_FILTER_NAME);
    const currentUser = getCurrentUser();
    const categorySlug = desentinel(router.get('categoryName'), DEFAULT_CATEGORY_NAME);
    const tagName = desentinel(router.get('tagName'), DEFAULT_TAG_NAME);

    let filter = {}

    if (filterName === FILTER_BY_TOPIC) {
      filter.username = currentUser.username;
    }

    if (categorySlug) {
      filter.category = categorySlug;
    }

    if (tagName) {
      filter.tags = [tagName];
    }

    return filter;
  }

  getSnapshotSort() {
    const sortBy = router.get('sortName');

    let sort = {};

    if (sortBy === MOST_REPLY_SORT) {
      sort.repliesTotal = -1;
    }

    if (sortBy === MOST_LIKES_SORT) {
      sort['reactionCounts.like'] = -1;
    }

    // sort newest first by default AND also sort that way as a secondary sort,
    // so add it on regardless
    sort._id = -1;

    return sort;
  }

  // the API calls take URI parameters
  getAPIFilter() {
    return this.getSnapshotFilter();
  }

  getAPISort() {
    const sortBy = router.get('sortName');
    switch (sortBy) {
      case MOST_REPLY_SORT:
        return '-repliesTotal,-id';
      case MOST_LIKES_SORT:
        return '-likesTotal,-id';
      default:
        return '-id';
    }
  }

  fetchLatestFilterAndSort() {
    var url = `/v1/forums/${getForumId()}/topics`;
    var data = this.getAPIFilter();
    data.sort = this.getAPISort();

    return apiClient.get(url, data)
      .bind(this)
      .then(function(results) {
        // TODO: not sure if this is best. Maybe call .set() directly and
        // override some options?
        this.topicCollection.handleSnapshot(results);
      });
  }


  //Return all the viable models in the collection to the UI
  getTopics() {
    return this.collection.map(model => {
      return parseTopic(model.toPOJO());
    });
  }

  //Return a draft model to the UI as it is removed from teh filtered collection
  //we need an extra function
  getDraftTopic(){
    const model = this.topicCollection.findWhere({ state: MODEL_STATE_DRAFT });

    //Return a sensible default
    if(!model) { return _.extend({}, modelDefaults); }

    //Or just return the model
    return Object.assign({}, model.toPOJO(), {
      //Add the validation errors into the returned data
      //so we can show validation errors
      validationError: model.validationError
    });
  }

  //Get a model by its ID attribute
  getById(id) {
    const model = this.collection.get(id);
    if(!model) { return; }
    return parseTopic(model.toPOJO());
  }

  //Whenever the router updates make sure we have to
  //correctly filtered models to give to the UI
  onRouterUpdate() {
    this.topicCollection.setSnapshotFilter(this.getSnapshotFilter());
    this.collection.setFilter(this.getFilter());
    this.fetchLatestFilterAndSort();
  }

  //Sort your bad self
  onSortUpdate(){
    this.topicCollection.setSnapshotSort(this.getSnapshotSort());
    this.collection.sort();
    this.fetchLatestFilterAndSort();
  }

  onRequestSubscriptionStateUpdate({topicId}) {
    var topic = this.collection.get(topicId);
    if(!topic) { return; }

    topic.set({
      subscriptionState: SUBSCRIPTION_STATE_PENDING
    });
  }

  onSubscriptionStateUpdate({topicId, state}) {
    const topic = this.collection.get(topicId);
    if(!topic) { return; }

    topic.set({
      subscriptionState: state
    });
  }

}

//All events that must be observed
dispatchOnChangeMixin(TopicsStore, [
  'sort',
  'invalid',
  'change:reactions',
  'change:ownReactions',
  'change:subscriptionState',
  'change:title',
  'change:editedTitle',
  'change:body',
  'change:text',
  'change:categoryId',
  'change:tags',
  'change:isEditing'
], {
  delay: function(model) {
    // We need synchronous updates so the cursor is managed properly
    if(model && (model.get('isEditing') || model.get('state') === MODEL_STATE_DRAFT)) {
      return 0;
    }
  }
});


const serverStore = (getContext().topicsStore || {});
const serverData = (serverStore.data || []);
let store;
export function getTopicsStore(data){
  if(!store) { store = new TopicsStore(serverData); }
  //TODO remove, this was for testing and to be frank is slightly dangerous...
  if(data) { store.set(data); }
  return store;
}
