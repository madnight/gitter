import assert from 'assert';
import React from 'react';
import { shallow } from 'enzyme';
import Modal from '../../../../../shared/containers/components/modal.jsx';

describe('<Modal/>', () => {

  let wrapper;
  let activeWrapper;

  beforeEach(() => {
    wrapper = shallow(<Modal active={false}/>);
    activeWrapper = shallow(<Modal active={true}/>);
  });

  it('should render a section', () => {
    assert.equal(wrapper.find('section').length, 1);
  });

  it('should render with the right class', () => {
    assert.equal(wrapper.find('.modal').length, 1);
  });

  it('should render with the right active class', () => {
    assert.equal(activeWrapper.find('.modal--active').length, 1);
  });

  it('should render an article', () => {
    assert.equal(wrapper.find('article').length, 1);
  });

  it('should render the right body class', () => {
    assert.equal(wrapper.find('.modal__body').length, 1);
  });

});
