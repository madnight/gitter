import React from 'react';

//Containers
import ForumContainer from '../../shared/containers/ForumContainer.jsx';
import TopicContainer from '../../shared/containers/TopicContainer.jsx';

import NewReplyStore from './stores/new-reply-store';
import NewCommentStore from './stores/new-comment-store-store';

import {getGroupStore} from './stores/group-store';
import {getForumStore} from './stores/forum-store';
import {getCurrentUserStore} from './stores/current-user-store';
import {getForumTagStore} from './stores/forum-tag-store';
import {getForumCategoryStore} from './stores/forum-category-store';
import {getTopicsStore} from './stores/topics-store';
import {getRepliesStore} from './stores/replies-store';
import {getCommentsStore} from './stores/comments-store';

import * as navConstants from '../../shared/constants/navigation';

export default React.createClass({

  displayName: 'App',

  propTypes: {
    //System router
    router: React.PropTypes.shape({
      get: React.PropTypes.func.isRequired,
      set: React.PropTypes.func.isRequired,
    })
  },

  componentDidMount(){
    const {router} = this.props;
    router.on('change:route', this.onRouteUpdate, this);
    this.hasRendered = true;
  },

  componentWillUnmount(){
    const {router} = this.props;
    router.off('change:route', this.onRouteUpdate, this);
  },

  getInitialState(){
    return this.getStateForRoute();
  },

  render(){
    const { route } = this.state;
    switch(route) {
      case navConstants.FORUM_ROUTE: return <ForumContainer {...this.state} />;
      case navConstants.CREATE_TOPIC_ROUTE: return <ForumContainer {...this.state} />;
      case navConstants.TOPIC_ROUTE: return <TopicContainer {...this.state} />;
    }
  },

  //STATE -----------------------------------
  getStateForRoute(){
    const { router } = this.props;
    switch(router.get('route')) {
      case navConstants.FORUM_ROUTE: return this.getForumState();
      case navConstants.CREATE_TOPIC_ROUTE: return this.getCreateTopicState();
      case navConstants.TOPIC_ROUTE: return this.getTopicState();
    }
  },

  getDefaultState(){
    const { router } = this.props;
    return {
      route: router.get('route'),
      router: router,
      groupStore: getGroupStore(),
      forumStore: getForumStore(),
      currentUserStore: getCurrentUserStore(),
      categoryStore: getForumCategoryStore(),
      tagStore: getForumTagStore(),
    };
  },

  getForumState(){
    const { router } = this.props;
    //Construct State
    return Object.assign(this.getDefaultState(), {
      //Route params
      categoryName: router.get('categoryName'),
      filterName: router.get('filterName'),
      tagName: router.get('tagName'),
      sortName: router.get('sortName'),
      //Stores
      topicsStore: getTopicsStore(),
      createTopic: false,
    });
  },

  getCreateTopicState(){
    const { router } = this.props;
    return Object.assign(this.getForumState(), {
      createTopic: router.get('createTopic'),
    });
  },

  getTopicState(){
    var {router} = this.props;
    return Object.assign(this.getDefaultState(), {
      topicId: router.get('topicId'),
      sortName: router.get('sortName'),
      topicsStore: getTopicsStore(),
      repliesStore: getRepliesStore(),
      newReplyStore: new NewReplyStore(),
      commentsStore: getCommentsStore(),
      newCommentStore: new NewCommentStore(),
    });
  },

  //EVENT HANDLES ---------------------------
  onRouteUpdate() {
    this.setState(this.getStateForRoute());
  }

});
