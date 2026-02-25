import React, { useState } from 'react';

const TabsContext = React.createContext({ value: '', onChange: () => {} });

export function Tabs({ defaultValue, children, className = '' }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, onChange: setValue }}>
      <div className={className}>{children}</div>
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
