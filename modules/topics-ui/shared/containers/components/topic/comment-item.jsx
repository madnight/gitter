import React, { PropTypes } from 'react';
import FeedItem from './feed-item.jsx';
import ReactionButton from '../forum/reaction-button.jsx';

export default React.createClass({

  displayName: 'CommentItem',
  propTypes: {
    comment: PropTypes.shape({
      id: PropTypes.string,
      body: PropTypes.shape({
        text: PropTypes.string.isRequired,
      })
    }),
    onReactionPick: PropTypes.func,
    onEditClick: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired
  },

  render(){
    const {comment} = this.props;
    return (
      <FeedItem
        item={comment}
        onEditClick={this.onEditClick}
        onChange={this.onChange}
        onCancel={this.onCancel}
        onSave={this.onSave}
        onDelete={this.onDelete}
        footerChildren={this.getFeedItemFooterChildren()}/>
    );
  },

  onEditClick() {
    const { onEditClick } = this.props;
    if(onEditClick) {
      onEditClick();
    }
  },

  onChange(val){
    this.props.onChange(val);
  },

  onCancel(val){
    this.props.onCancel(val);
  },

  onSave(val){
    this.props.onSave(val);
  },

  onDelete() {
    const { onDelete } = this.props;
    onDelete();
  },

  getFeedItemFooterChildren(){
    const { comment } = this.props;
    return [
      <ReactionButton
        key="reactions"
        reactionCountMap={comment.reactions}
        ownReactionMap={comment.ownReactions}
        onReactionPick={this.onReactionPick}/>,
    ];
  },

  onReactionPick(reactionKey, isReacting) {
    const {comment, onReactionPick} = this.props;
    if(onReactionPick) {
      onReactionPick(comment.id, reactionKey, isReacting);
    }
  },

});
