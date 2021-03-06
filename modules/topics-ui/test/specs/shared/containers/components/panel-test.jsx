import assert from 'assert';
import React from 'react';
import { shallow } from 'enzyme';
import Panel from '../../../../../shared/containers/components/panel.jsx';

describe('<Panel />', function(){

  it('should wrap its children with a container div', function(){
    var wrapper = shallow(<Panel />);
    assert.equal(wrapper.find('.panel').length, 1);
  });

  it('should render its children', function(){
    var wrapper = shallow(
      <Panel>
        <section className="test" />
        <section className="test" />
        <section className="test" />
      </Panel>
    );

    assert.equal(wrapper.find('.test').length, 3);
  });

  it('should compound classnames', function(){
    var wrapper = shallow(<Panel className="test" />);
    assert.equal(wrapper.find('.test').length, 1);
  });

});
