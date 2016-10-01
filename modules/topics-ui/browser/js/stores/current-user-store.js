import Backbone from 'backbone';

const CurrentUserStore = Backbone.Model.extend({
  getCurrentUser() {
    return this.toJSON();
  },

  getIsSignedIn() {
    return !!this.get('id');
  }
});


const serverStore = (window.context.currentUserStore || {});
const serverData = (serverStore.data || {});
const store = new CurrentUserStore(serverData);

export function getCurrentUserStore(data){
  if(data) { store.set(data); }
  return store;
}

export function getCurrentUser(){
  return getCurrentUserStore().getCurrentUser();
}

export function getIsSignedIn(){
  return getCurrentUserStore().getIsSignedIn();
}

export default store;
