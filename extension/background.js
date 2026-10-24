"use strict";
// The action grants activeTab for the selected page. Opening through the built-in
// side-panel toggle does not grant it (Chromium issue 40904917).
// Page contents are read only after the separate import button is pressed.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
chrome.action.onClicked.addListener(tab => {
  if (Number.isInteger(tab.windowId)) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
  }
});
