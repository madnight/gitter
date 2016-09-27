import React, {PropTypes, createClass} from 'react';
import {dispatch} from '../dispatcher';
import canEdit from '../utils/can-edit';

import TopicHeader from './components/topic/topic-header.jsx';
import TopicBody from './components/topic/topic-body.jsx';
import SearchHeader from './components/search/search-header.jsx';
import TopicReplyEditor from './components/topic/topic-reply-editor.jsx';
import TopicReplyListHeader from './components/topic/topic-reply-list-header.jsx';
import TopicReplyList from './components/topic/topic-reply-list.jsx';
import TopicReplyListItem from './components/topic/topic-reply-list-item.jsx';

import updateReplyBody from '../action-creators/create-reply/body-update';
import submitNewReply from '../action-creators/create-reply/submit-new-reply';
import updateCommentBody from '../action-creators/create-comment/body-update';
import submitNewComment from '../action-creators/create-comment/submit-new-comment';
import showReplyComments from '../action-creators/topic/show-reply-comments';
import updateReply from '../action-creators/topic/update-reply';
import cancelUpdateReply from '../action-creators/topic/cancel-update-reply';
import saveUpdatedReply from '../action-creators/topic/save-update-reply';
import updateComment from '../action-creators/topic/update-comment.js';
import updateCancelComment from '../action-creators/topic/update-cancel-comment.js';
import updateSaveComment from '../action-creators/topic/update-save-comment.js';
import updateTopic from '../action-creators/topic/update-topic';
import updateCancelTopic from '../action-creators/topic/update-cancel-topic';
import updateSaveTopic from '../action-creators/topic/update-save-topic';
import requestSignIn from '../action-creators/forum/request-sign-in';

const EDITOR_SUBMIT_LINK_SOURCE = 'topics-reply-editor-submit-button';
const EDITOR_CLICK_LINK_SOURCE = 'topics-reply-editor-click';

const TopicContainer = createClass({

  displayName: 'TopicContainer',
  propTypes: {

    topicId: PropTypes.string.isRequired,
    groupName: PropTypes.string.isRequired,

    forumStore: PropTypes.shape({
      getForum: PropTypes.func.isRequired,
    }).isRequired,

    topicsStore: PropTypes.shape({
      getById: PropTypes.func.isRequired,
    }).isRequired,

    repliesStore: PropTypes.shape({
      getReplies: PropTypes.func.isRequired
    }).isRequired,

    commentsStore: PropTypes.shape({
      getComments: PropTypes.func.isRequired,
    }),

    categoryStore: PropTypes.shape({
      getCategories: PropTypes.func.isRequired,
    }).isRequired,

    tagStore: PropTypes.shape({
      getTags: PropTypes.func.isRequired,
      getTagsByLabel: PropTypes.func.isRequired,
    }).isRequired,

    currentUserStore: PropTypes.shape({
      getCurrentUser: PropTypes.func.isRequired,
      getIsSignedIn: PropTypes.func.isRequired,
    }).isRequired,

    newReplyStore: PropTypes.shape({
      get: PropTypes.func.isRequired,
    }),

    newCommentStore: PropTypes.shape({
      get: PropTypes.func.isRequired,
    }),

  },

  componentDidMount(){
    const {repliesStore, newReplyStore, commentsStore, newCommentStore, topicsStore} = this.props;
    repliesStore.onChange(this.updateReplies, this);
    commentsStore.onChange(this.updateComments, this);
    newCommentStore.onChange(this.updateNewComment, this);
    topicsStore.onChange(this.updateTopics, this);

    newReplyStore.on('change:text', this.updateNewReplyContent, this);
  },

  componentWillUnmount(){
    const {repliesStore, newReplyStore, commentsStore, newCommentStore, topicsStore} = this.props;
    repliesStore.removeListeners(this.updateReplies, this);
    commentsStore.removeListeners(this.updateComments, this);
    newCommentStore.removeListeners(this.updateNewComment, this);
    topicsStore.removeListeners(this.updateTopics, this);

    newReplyStore.off('change:text', this.updateNewReplyContent, this);
  },

  getInitialState(){
    return {
      newReplyContent: '',
    };
  },

  getParsedTopic(){
    const { topicId, topicsStore, forumStore, currentUserStore } = this.props;
    const topic = topicsStore.getById(topicId);
    const forum = forumStore.getForum();
    const currentUser = currentUserStore.getCurrentUser();
    return Object.assign({}, topic, {
      canEdit: canEdit(forum, currentUser, topic),
    });
  },

  //TODO We need to cache this result somewhere
  //otherwise this is going to get very time consuming
  getParsedReplies(){
    const {repliesStore, commentsStore, forumStore, currentUserStore} = this.props;
    const forum = forumStore.getForum();
    const currentUser = currentUserStore.getCurrentUser();

    return repliesStore.getReplies().map((reply) => Object.assign({}, reply, {
      comments: this.getParsedCommentsForReply(reply.id),
      isCommenting: commentsStore.getActiveReplyId() === reply.id,
      canEdit: canEdit(forum, currentUser, reply)
    }));
  },

  //TODO need to cache here as well
  getParsedCommentsForReply(replyId) {
    const {commentsStore, forumStore, currentUserStore} = this.props;
    const forum = forumStore.getForum();
    const currentUser = currentUserStore.getCurrentUser();

    return commentsStore.getCommentsByReplyId(replyId)
    .map((comment) => Object.assign({}, comment, {
      canEdit: canEdit(forum, currentUser, comment)
    }));
  },


  render(){

    const { groupName, categoryStore, currentUserStore, tagStore} = this.props;
    const {newReplyContent} = this.state;

    const topic = this.getParsedTopic();
    const parsedReplies = this.getParsedReplies();

    const currentUser = currentUserStore.getCurrentUser();
    const isSignedIn = currentUserStore.getIsSignedIn();
    const topicCategory = topic.category;
    const category = categoryStore.getById(topicCategory.id);

    //TODO remove
    //This is here because sometimes you can get un-parsed tags
    //we need to hydrate the client stores with the raw SS data
    //not the parsed data which will avoid nesting and inconsistent data
    const tagValues = topic.tags.map(function(t){
      return t.label ? t.label : t;
    });
    const tags = tagStore.getTagsByLabel(tagValues);

    return (
      <main>
        <SearchHeader
          groupName={groupName}/>
        <article>
          <TopicHeader
            topic={topic}
            category={category}
            groupName={groupName}
            tags={tags}/>
          <TopicBody
            topic={topic}
            onTopicEditUpdate={this.onTopicEditUpdate}
            onTopicEditCancel={this.onTopicEditCancel}
            onTopicEditSave={this.onTopicEditSave}/>
        </article>
        <TopicReplyListHeader replies={parsedReplies}/>
        <TopicReplyList>
          {parsedReplies.map(this.getReplyListItem)}
        </TopicReplyList>
        <TopicReplyEditor
          user={currentUser}
          isSignedIn={isSignedIn}
          value={newReplyContent}
          onChange={this.onNewReplyEditorUpdate}
          onSubmit={this.onNewReplyEditorSubmit}
          onEditorClick={this.onReplyEditorClick}/>
      </main>
    );
  },


  getReplyListItem(reply, index){
    const {newCommentStore, currentUserStore} = this.props;
    const currentUser = currentUserStore.getCurrentUser();
    return (
      <TopicReplyListItem
        reply={reply}
        key={`topic-reply-list-item-${reply.id}-${index}`}
        currentUser={currentUser}
        newCommentContent={newCommentStore.get('text')}
        onCommentsClicked={this.onReplyCommentsClicked}
        onNewCommentUpdate={this.onNewCommentUpdate}
        submitNewComment={this.submitNewComment}
        onReplyEditUpdate={this.onReplyEditUpdate}
        onReplyEditCancel={this.onReplyEditCancel}
        onReplyEditSaved={this.onReplyEditSaved}
        onCommentEditUpdate={this.onCommentEditUpdate}
        onCommentEditCancel={this.onCommentEditCancel}
        onCommentEditSave={this.onCommentEditSave}/>
    );
  },

  onNewReplyEditorUpdate(val){
    dispatch(updateReplyBody(val));
  },

  onNewReplyEditorSubmit(){
    const {newReplyStore, currentUserStore} = this.props;
    const isSignedIn = currentUserStore.getIsSignedIn();

    if(isSignedIn) {
      dispatch(submitNewReply(newReplyStore.get('text')));
      //Clear input
      newReplyStore.clear();
      this.setState((state) => Object.assign(state, {
        newReplyContent: '',
      }));
    }

    else {
      requestSignIn(EDITOR_SUBMIT_LINK_SOURCE);
    }
  },

  onReplyEditorClick() {
    const { currentUserStore } = this.props;
    const isSignedIn = currentUserStore.getIsSignedIn();

    if(!isSignedIn) {
      requestSignIn(EDITOR_CLICK_LINK_SOURCE);
    }
  },

  updateNewReplyContent(){
    const {newReplyStore} = this.props;
    const newReplyContent = newReplyStore.get('text');
    this.setState((state) => Object.assign(state, {
      newReplyContent: newReplyContent,
    }));
  },

  updateReplies(){
    const {repliesStore} = this.props;
    this.setState((state) => Object.assign(state, {
      replies: repliesStore.getReplies(),
      newReplyContent: '',
    }));
  },

  updateComments(){
    this.forceUpdate();
  },

  onReplyCommentsClicked(replyId){
    dispatch(showReplyComments(replyId));
  },

  onNewCommentUpdate(replyId, val) {
    dispatch(updateCommentBody(replyId, val));
  },

  submitNewComment(){
    const {newCommentStore} = this.props;
    dispatch(submitNewComment(
      newCommentStore.get('replyId'),
      newCommentStore.get('text')
    ));
  },

  updateNewComment(){ this.forceUpdate(); },
  updateTopics() { this.forceUpdate(); },

  onReplyEditUpdate(replyId, value){
    dispatch(updateReply(replyId, value));
  },

  onReplyEditCancel(replyId) {
    dispatch(cancelUpdateReply(replyId));
  },

  onReplyEditSaved(replyId){
    dispatch(saveUpdatedReply(replyId));
  },

  onCommentEditUpdate(commentId, value){
    dispatch(updateComment(commentId, value));
  },

  onCommentEditCancel(commentId) {
    dispatch(updateCancelComment(commentId));
  },

  onCommentEditSave(commentId){
    dispatch(updateSaveComment(commentId));
  },

  onTopicEditUpdate(value){
    dispatch(updateTopic(value));
  },

  onTopicEditCancel(){
    dispatch(updateCancelTopic());
  },

  onTopicEditSave(){
    dispatch(updateSaveTopic());
  }

});

export default TopicContainer;
