import assert, { equal } from 'assert';
import React from 'react';
import sinon, {spy} from 'sinon';
import { shallow } from 'enzyme';
import { subscribe } from '../../../../shared/dispatcher';
import ForumContainer from '../../../../shared/containers/ForumContainer.jsx';

import * as forumFilterConstants from '../../../../shared/constants/forum-filters';
import * as forumSortConstants from '../../../../shared/constants/forum-sorts';
import * as forumTagConstants from '../../../../shared/constants/forum-tags';
import * as createConst from '../../../../shared/constants/create-topic';
import {REQUEST_UPDATE_FORUM_SUBSCRIPTION_STATE} from '../../../../shared/constants/forum.js';

import groupStore from '../../../mocks/group-store';
import forumStore from '../../../mocks/forum-store';
import currentUserStore from '../../../mocks/current-user-store';
import categoryStore from '../../../mocks/category-store';
import tagStore from '../../../mocks/tag-store';
import topicsStore from '../../../mocks/topic-store';

describe('<ForumContainer />', function(){

  let wrapper;
  let filterChangeHandle;
  let sortChangeHandle;
  let tagChangeHandle;


  beforeEach(function(){
    filterChangeHandle = sinon.spy();
    sortChangeHandle = sinon.spy();
    tagChangeHandle = sinon.spy();
    wrapper = shallow(
      <ForumContainer
        groupStore={groupStore}
        forumStore={forumStore}
        currentUserStore={currentUserStore}
        categoryStore={categoryStore}
        categoryName="all"
        tagStore={tagStore}
        topicsStore={topicsStore}/>
    );
  });

  it('should dispatch the right action when a filter changes', () => {
    subscribe(forumFilterConstants.NAVIGATE_TO_FILTER, filterChangeHandle);
    wrapper.find('ForumTableControl').prop('filterChange')('all');
    assert.equal(filterChangeHandle.callCount, 1);
  });

  it('should dispatch the right action when a sort changes', () => {
    subscribe(forumSortConstants.NAVIGATE_TO_SORT, sortChangeHandle);
    wrapper.find('ForumTableControl').prop('sortChange')('all');
    assert.equal(sortChangeHandle.callCount, 1);
  });

  it('should dispatch the right action when a tag changes', () => {
    subscribe(forumTagConstants.NAVIGATE_TO_TAG, tagChangeHandle);
    wrapper.find('ForumTableControl').prop('tagChange')('all');
    assert.equal(tagChangeHandle.callCount, 1);
  });

  it('should render a TopicsTable', () => {
    assert.equal(wrapper.find('TopicsTable').length, 1);
  });

  it('should render a SearchHeaderContainer', () => {
    assert.equal(wrapper.find('SearchHeaderContainer').length, 1);
  });

  it('should render the create topic modal', () => {
    equal(wrapper.find('CreateTopicModal').length, 1);
  });

  it('should dispatch a title update event when the title updates', () => {
    const handle = spy();
    subscribe(createConst.TITLE_UPDATE, handle);
    wrapper.find('CreateTopicModal').at(0).prop('onTitleChange')('This is a topic');
    equal(handle.callCount, 1);
  });

  it('should dispatch a title update event when the title updates', () => {
    const handle = spy();
    subscribe(createConst.BODY_UPDATE, handle);
    wrapper.find('CreateTopicModal').at(0).prop('onBodyChange')('This is some body copy');
    equal(handle.callCount, 1);
  });

  //Passes when run with .only
  it('should dispatch the right event when the form is submitted', () => {
    const handle = spy();
    subscribe(createConst.SUBMIT_NEW_TOPIC, handle);
    wrapper.find('CreateTopicModal').at(0).prop('onSubmit')()
    equal(handle.callCount, 1);
  });

  it('should dispatch the right action when the create topic category changes', () => {
    const handle = spy();
    subscribe(createConst.CATEGORY_UPDATE, handle);
    wrapper.find('CreateTopicModal').at(0).prop('onCategoryChange')('1');
    equal(handle.callCount, 1);
  });

  it('should dispatch the right action then the create topic tags change', () => {
    const handle = spy();
    subscribe(createConst.TAGS_UPDATE, handle);
    wrapper.find('CreateTopicModal').at(0).prop('onTagsChange')(['1', '2', '3']);
    equal(handle.callCount, 1);
  });

  it('should dispatch the right action when the button from ForumFollowArea is clicked', () => {
    const handle = spy();
    subscribe(REQUEST_UPDATE_FORUM_SUBSCRIPTION_STATE, handle);
    wrapper.find('ForumFollowArea').at(0).prop('onSubscriptionClicked')();
    equal(handle.callCount, 1);
  });

});
