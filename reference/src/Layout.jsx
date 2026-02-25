import React from 'react';

export default function Layout({ children, currentPageName }) {
  return (
    <>
      <style>
        {`
          /* Electron-specific CSS for native dragging */
          .electron-draggable {
            -webkit-app-region: drag;
          }
          
          .electron-no-drag {
            -webkit-app-region: no-drag;
          }
          
          /* Ensure interactive elements in draggable areas work properly */
          .electron-draggable button,
          .electron-draggable input,
          .electron-draggable textarea,
          .electron-draggable select,
          .electron-draggable .electron-no-drag {
            -webkit-app-region: no-drag;
          }
        `}
      </style>
      <div className="app-layout">
        {children}
      </div>
    </>
  );
}