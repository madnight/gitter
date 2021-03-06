import getContext from '../utils/context';
import { BaseModel } from './base-model';

const GroupStore = BaseModel.extend({

  events: [
    'change:id'
  ],

  getGroup() {
    return this.toPOJO();
  },

  getGroupId() {
    return this.get('id');
  },

  getGroupUri() {
    return this.get('uri');
  },

  getGroupName() {
    return this.get('name');
  },

  getGroupAvatarUrl(){
    return this.get('avatarUrl');
  }
});


let store;

const serverSideStore = (getContext().groupStore || {});
const serverSideData = (serverSideStore.data || {});

export function getGroupStore() {
  if(!store) { store = new GroupStore(serverSideData); }
  return store;
}

export function getGroup(){
  return getGroupStore().getGroup();
}

export function getGroupId(){
  return getGroupStore().getGroup()
}

export function getGroupUri(){
  return getGroupStore().getGroupUri()
}

export function getGroupName(){
  return getGroupStore().getGroupName()
}
