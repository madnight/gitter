import {equal} from 'assert';

import createAction from '../../../../../shared/action-creators/forum/update-reply-subscription-state';
import { UPDATE_REPLY_SUBSCRIPTION_STATE } from '../../../../../shared/constants/forum';

describe('updateReplySubscriptionState', () => {

  it('should return the right type', () => {
    equal(createAction().type, UPDATE_REPLY_SUBSCRIPTION_STATE);
  });

});
