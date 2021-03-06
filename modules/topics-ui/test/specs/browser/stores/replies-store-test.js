import assert from 'assert';
import {dispatch} from '../../../../shared/dispatcher';

import forumStore from '../../../mocks/forum-store';
import replies from '../../../mocks/mock-data/replies';
import router from '../../../mocks/router';

import navigateToTopic from '../../../../shared/action-creators/topic/navigate-to-topic';
import updateReply from '../../../../shared/action-creators/topic/update-reply';
import cancelUpdateReply from '../../../../shared/action-creators/topic/cancel-update-reply';

import {
  TOPIC_REPLIES_COMMENT_SORT_NAME,
  TOPIC_REPLIES_LIKED_SORT_NAME,
  TOPIC_REPLIES_RECENT_SORT_NAME
} from '../../../../shared/constants/topic';

// eslint-disable-next-line import/no-unresolved
import storeInjector from 'inject-loader!../../../../browser/js/stores/replies-store';
const {RepliesStore} = storeInjector({
  '../routers': router
});

describe('RepliesStore', () => {

  let store;
  beforeEach(() => {
    store = new RepliesStore(replies, {
      forumStore: forumStore,
    });
  });

  it('should provide a getReplies()', () => {
    assert(store.getReplies);
  });

  it('should reset when navigating to topic', () => {
    assert(store.length);
    dispatch(navigateToTopic());
    assert.equal(store.length, 0);
  });

  it('should update a model when the updateReply action is dispatched', () => {
    dispatch(updateReply('1', 'test'));
    const result = store.get('1').get('text');
    assert.equal(result, 'test');
  });

  it('should reset the text value when a cancel edit action is called', () => {
    dispatch(updateReply('1', 'test'));
    assert.equal(store.get('1').get('text'), 'test');
    dispatch(cancelUpdateReply('1'));
    assert.equal(store.get('1').get('text'), null);
  });

  it('should sort by comments total when the router is in the right state', () => {
    router.set('sortName', TOPIC_REPLIES_COMMENT_SORT_NAME);
    store.models.forEach((model, index) => {
      const nextModel = store.at(index + 1);
      if(!nextModel) { return; }
      assert(model.get('commentsTotal') > nextModel.get('commentsTotal'));
    });
  });

  it('should sort by likes total when the router is in the right state', () => {
    router.set('sortName', TOPIC_REPLIES_LIKED_SORT_NAME);
    store.models.forEach((model, index) => {
      const nextModel = store.at(index + 1);
      if(!nextModel) { return; }
      assert(model.get('reactions').like > nextModel.get('reactions').like);
    });
  });

  it('should sort by sent date when the router is in the right state', () => {
    router.set('sortName', TOPIC_REPLIES_RECENT_SORT_NAME);
    store.models.forEach((model, index) => {
      const nextModel = store.at(index + 1);
      if(!nextModel) { return; }
      assert(new Date(model.get('sent')) > new Date(nextModel.get('sent')));
    });
  });


});
