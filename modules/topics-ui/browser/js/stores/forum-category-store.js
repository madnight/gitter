import { Collection, Model } from 'backbone';
import { UPDATE_ACTIVE_CATEGORY } from '../../../shared/constants/forum-categories';

var CategoryModel = Model.extend({
  defaults: { category: null },
});

export default Collection.extend({
  model: CategoryModel,

  initialize: function(models, attrs) {
    this.router = attrs.router;
    this.listenTo(this.router, 'change:categoryName', this.onCategoryUpdate, this);
  },

  getCategories: function() {
    return this.models.map(model => model.toJSON());
  },

  getActiveCategoryName(){
    return this.findWhere({ active: true }).get('category');
  },

  onCategoryUpdate(model, val){
    this.where({ active: true }).forEach((m) => m.set('active', false));
    var activeModel = this.findWhere({ category: val });
    if(activeModel) { activeModel.set('active', true); }
    this.trigger(UPDATE_ACTIVE_CATEGORY);
  }

});