'use strict';

const React = require('react');
const Backbone = require('backbone');
const ForumContainer = require('../../containers/ForumContainer.jsx');
const CategoryStore = require('./stores/forum-category-store');

module.exports = React.createClass({

  displayName: 'App',

  propTypes: {
    //System router
    router: React.PropTypes.shape({
      get: React.PropTypes.func.isRequired,
      set: React.PropTypes.func.isRequired,
    }),

    //CategoryStore (not required as not ALWAYS needed)
    categoryStore: React.PropTypes.shape({
      models: React.PropTypes.array.isRequired,
      getCategories: React.PropTypes.func.isRequired
    })
  },

  getInitialState(){
    const { router } = this.props;
    switch(router.get('route')) {
      case 'forum': return this.getForumState();
    }
  },

  render(){
    const { route } = this.state;
    switch(route) {
      case 'forum': return <ForumContainer {...this.state} />
    }
  },

  getDefaultState(){
    const { router } = this.props;
    return { route: router.get('route') };
  },

  getForumState(){
    const categoryStore = (window.context.categoryStore || {});
    const { router } = this.props;
    return Object.assign(this.getDefaultState(), {
      groupName: router.get('groupName'),
      categoryStore: new CategoryStore(categoryStore.models),
    });
  }

});
