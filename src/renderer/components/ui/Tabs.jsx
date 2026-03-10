import React, { useState } from 'react';

const TabsContext = React.createContext({ value: '', onChange: () => {} });

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className = '',
  style,
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const handleChange = controlledValue !== undefined
    ? (nextValue) => onValueChange?.(nextValue)
    : setUncontrolledValue;

  return (
    <TabsContext.Provider value={{ value, onChange: handleChange }}>
      <div className={className} style={style}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = '', style }) {
  return (
    <div className={`tabs-list ${className}`} style={style} role="tablist">
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = '' }) {
  return (
    <TabsContext.Consumer>
      {({ value: selected, onChange }) => (
        <button
          type="button"
          role="tab"
          data-state={selected === value ? 'active' : 'inactive'}
          className={`tabs-trigger ${className}`}
          onClick={() => onChange(value)}
        >
          {children}
        </button>
      )}
    </TabsContext.Consumer>
  );
}

export function TabsContent({ value, children, className = '' }) {
  return (
    <TabsContext.Consumer>
      {({ value: selected }) => (
        <div
          role="tabpanel"
          data-state={selected === value ? 'active' : 'inactive'}
          className={`tabs-content ${className}`}
        >
          {children}
        </div>
      )}
    </TabsContext.Consumer>
  );
}
