import { parse, stringify } from 'qs';
import Backbone from 'backbone';
import { subscribe } from '../../../shared/dispatcher';

import {getIsSignedIn} from '../stores/current-user-store';
import frameUtils from 'gitter-web-frame-utils';

import { NAVIGATE_TO_FORUMS } from '../../../shared/constants/forum';
import * as navConstants from '../../../shared/constants/navigation';
import * as forumCatConstants from '../../../shared/constants/forum-categories';
import * as forumFilterConstants from '../../../shared/constants/forum-filters';
import * as forumTagConstants from '../../../shared/constants/forum-tags';
import * as forumSortConstants from '../../../shared/constants/forum-sorts';
import * as createTopicConstants from '../../../shared/constants/create-topic';
import * as topicConstants from '../../../shared/constants/topic';

import requestSignIn from '../../../shared/action-creators/forum/request-sign-in';


var RouteModel = Backbone.Model.extend({
  //Do we need to use the constructor to get the default values out of the window.context
  defaults: {
    route: null,
    createTopic: false
  }
});

var Router = Backbone.Router.extend({

  constructor: function() {
    this.model = new RouteModel();

    subscribe(NAVIGATE_TO_FORUMS, this.navigateToForums, this);
    subscribe(forumCatConstants.NAVIGATE_TO_CATEGORY, this.updateForumCategory, this);
    subscribe(forumFilterConstants.NAVIGATE_TO_FILTER, this.updateForumFilter, this);
    subscribe(forumTagConstants.NAVIGATE_TO_TAG, this.updateForumTag, this);
    subscribe(forumSortConstants.NAVIGATE_TO_SORT, this.updateForumSort, this);
    subscribe(navConstants.NAVIGATE_TO_TOPIC, this.navigateToTopic, this);
    subscribe(createTopicConstants.NAVIGATE_TO_CREATE_TOPIC, this.navigateToCreateTopic, this);
    subscribe(topicConstants.TOPIC_REPLIES_SORT_BY_COMMENTS, this.navigateToTopicRepliesSortByComments, this);
    subscribe(topicConstants.TOPIC_REPLIES_SORT_BY_LIKED, this.navigateToTopicRepliesSortByLikes, this);
    subscribe(topicConstants.TOPIC_REPLIES_SORT_BY_RECENT, this.navigateToTopicRepliesSortByRecent, this);

    this.listenTo(this.model, 'change:filterName', this.onFilterUpdate, this);
    this.listenTo(this.model, 'change:sortName', this.onSortUpdate, this);

    Backbone.Router.prototype.constructor.apply(this, arguments);
  },

  routes: {
    ':groupUri/topics/create-topic(/)(~topics)': 'createTopic',
    ':groupUri/topics(/categories/:categoryName)(/)(~topics)(?*queryString)': 'forums',
    ':groupUri/topics/topic/:id/:slug(/)(~topics)(?*queryString)': 'topic'
  },

  navigate(url, options) {

    //Remove ~topics from the url
    let appUrl = url.split('~')[0];

    //Remove the trailing slash
    if(appUrl[appUrl.length - 1] === '/') { appUrl = appUrl.substring(0, appUrl.length - 1); }
    if(appUrl[0] !== '/') { appUrl = '/' + appUrl; }

    //Proxy up to the frame
    frameUtils.postMessage({
      type: 'navigation',
      url: appUrl,
      urlType: 'topics',
      options: {
        disableFrameReload: true
      }
    });

    //Call super
    Backbone.Router.prototype.navigate.call(this, url, options);
  },

  createTopic(groupUri){
    this.model.set({
      route: navConstants.CREATE_TOPIC_ROUTE,
      groupUri: groupUri,
      categoryName: navConstants.DEFAULT_CATEGORY_NAME,
      createTopic: true,
    });
  },

  forums(groupUri, categoryName, queryString){
    const query = parse(queryString || '');
    this.model.set({
      route: navConstants.FORUM_ROUTE,
      groupUri: groupUri,
      categoryName: (categoryName || navConstants.DEFAULT_CATEGORY_NAME),
      filterName: (query.filter || navConstants.DEFAULT_FILTER_NAME),
      tagName: (query.tag || navConstants.DEFAULT_TAG_NAME),
      sortName: (query.sort || navConstants.DEFAULT_SORT_NAME),
      createTopic: false
    });
  },

  topic(groupUri, id, slug, queryString){
    const query = parse(queryString || '');
    this.model.set({
      route: navConstants.TOPIC_ROUTE,
      groupUri: groupUri,
      topicId: id,
      slug: slug,
      createTopic: false,
      sortName: (query.sort || topicConstants.TOPIC_REPLY_SORT_DEFAULT_NAME)
    });
    window.scrollTo(0, 0);
  },

  updateForumCategory(data){
    var url = this.buildForumUrl(data.category);
    this.navigate(url, { trigger: true });
  },

  updateForumFilter(data) {
    var url = this.buildForumUrl(undefined, data.filter);
    this.navigate(url, { trigger: true });
  },

  updateForumTag(data){
    var url = this.buildForumUrl(undefined, undefined, data.tag);
    this.navigate(url, { trigger: true });
  },

  updateForumSort(data){
    var url = this.buildForumUrl(undefined, undefined, undefined, data.sort);
    this.navigate(url, { trigger: true });
  },

  onFilterUpdate(model, val){
    this.model.trigger(forumFilterConstants.UPDATE_ACTIVE_FILTER, { filter: val });
  },

  onSortUpdate(model, val){
    this.model.trigger(forumSortConstants.UPDATE_ACTIVE_SORT, { sort: val });
  },

  navigateToForums() {
    var url = this.buildForumUrl();
    this.navigate(url, { trigger: true });
  },

  navigateToCreateTopic(data) {
    const { source } = data;

    if(getIsSignedIn()) {
      const groupUri = this.model.get('groupUri');
      this.navigate(`/${groupUri}/topics/create-topic/~topics`, { trigger: true });
    }
    else {
      requestSignIn(source);
      return;
    }

  },

  navigateToTopicRepliesSortByComments({topicId, slug}){
    const {TOPIC_REPLIES_COMMENT_SORT_NAME} = topicConstants;
    const groupUri = this.model.get('groupUri');
    const url = `/${groupUri}/topics/topic/${topicId}/${slug}/~topics?sort=${TOPIC_REPLIES_COMMENT_SORT_NAME}`;
    this.navigate(url, { trigger: true });
  },

  navigateToTopicRepliesSortByLikes({topicId, slug}){
    const {TOPIC_REPLIES_LIKED_SORT_NAME} = topicConstants;
    const groupUri = this.model.get('groupUri');
    const url = `/${groupUri}/topics/topic/${topicId}/${slug}/~topics?sort=${TOPIC_REPLIES_LIKED_SORT_NAME}`;
    this.navigate(url, { trigger: true });
  },

  navigateToTopicRepliesSortByRecent({topicId, slug}){
    const {TOPIC_REPLIES_RECENT_SORT_NAME} = topicConstants;
    const groupUri = this.model.get('groupUri');
    const url = `/${groupUri}/topics/topic/${topicId}/${slug}/~topics?sort=${TOPIC_REPLIES_RECENT_SORT_NAME}`;
    this.navigate(url, { trigger: true });
  },

  navigateToTopic(data){
    const url = `/${data.groupUri}/topics/topic/${data.id}/${data.slug}/~topics`;
    this.navigate(url, { trigger: true });
  },

  buildForumUrl(categoryName, filterName, tagName, sortName){

    var groupUri = this.model.get('groupUri');
    categoryName = (categoryName || this.model.get('categoryName') || navConstants.DEFAULT_CATEGORY_NAME);

    //Get current values and cancel anything that is a default
    filterName = (filterName || this.model.get('filterName'));
    if(filterName === navConstants.DEFAULT_FILTER_NAME) { filterName = undefined; }

    tagName = (tagName || this.model.get('tagName'));
    if(tagName === navConstants.DEFAULT_TAG_NAME) { tagName = undefined; }

    sortName = (sortName || this.model.get('sortName'));
    if(sortName === navConstants.DEFAULT_SORT_NAME) { sortName = undefined; }

    //Base URL
    let url = (categoryName === navConstants.DEFAULT_CATEGORY_NAME) ?
      `/${groupUri}/topics/~topics` :
      `${groupUri}/topics/categories/${categoryName}/~topics`;

    //QUERY STRING
    const query = stringify({
      filter: filterName,
      tag: tagName,
      sort: sortName,
    });

    if(query.length) { url = `${url}?${query}`; }
    return url;

  },

});

var router = new Router();
export default router.model;
