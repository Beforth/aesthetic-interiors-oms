import React from 'react';
import Select from './Select';

const text = (children) => (Array.isArray(children) ? children.join('') : children);

/** The `<option>` children of a browser dropdown, as a list. */
function optionsFrom(children, found = []) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'option') {
      const label = text(child.props.children);
      found.push({ value: child.props.value ?? label, label, disabled: child.props.disabled });
    } else {
      optionsFrom(child.props.children, found);
    }
  });
  return found;
}

/** BefUI's dropdown (https://befui.vercel.app/#/components/select), written like a browser one: `<option>` children. */
export function SelectField({ children, placeholder = '', ...props }) {
  return <Select {...props} placeholder={placeholder || ' '} options={optionsFrom(children)} />;
}

export default SelectField;
