// Requires editorDisplay.js to be loaded before

// vscode cannot be visible in global scope
(function () {
  const vscode = acquireVsCodeApi();

  const updateProvider = (content) => {
    console.log("Sent message to provider");
    vscode.postMessage({
      type: "editor-update",
      content: content,
    });
  };

  const editorDisplay = new EditorDisplay("editor-content", updateProvider);

  window.addEventListener("message", async (e) => {
    const recvData = e.data;
    switch (recvData.type) {
      case "ready-ack": {
        editorDisplay.updateContents(recvData.value);
        break;
      }
      case "update": {
        editorDisplay.updateContents(recvData.value);
        break;
      }
    }
  });

  vscode.postMessage({ type: "ready" });
})();
