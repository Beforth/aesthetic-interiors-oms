import React from 'react';
import Input from './Input';

/** A BefUI input for numbers that may have decimals or be negative (percentages, areas, map positions). */
export const NumberInput = React.forwardRef(function NumberInput({ onChange, max, ...props }, ref) {
  // a value over the limit (a percentage of 1000000, say) becomes the limit
  const handle = (e) => {
    if (max !== undefined && e.target.value !== '' && Number(e.target.value) > Number(max)) e.target.value = String(max);
    onChange?.(e);
  };
  return <Input ref={ref} {...props} max={max} onChange={handle} type="number" />;
});

export default NumberInput;
