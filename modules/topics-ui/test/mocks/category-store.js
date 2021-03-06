import Backbone from 'backbone';
import data from './mock-data/categories.js';

var CategoryStore = Backbone.Collection.extend({
  getCategories: function(){
    return this.models.map(function(model){ return model.toJSON(); });
  },
  mapForSelectControl(){ return this.models.map(() => ({
    value: '',
    label: '',
    selected: false,
  }))},
  getById(){ return this.models[0].toJSON(); }
});

var store = new CategoryStore(data);

afterEach(function(){
  store.reset(data);
});

export default store;
