import * as vscode from "vscode";
import { BinaryDocument, NotifyVSCodeMetadata, NotifyWebviewMetadata } from "./binaryDocument";
import { toHex } from "./util";

interface WebViewInfo {
  uri: string,
  webview: vscode.WebviewPanel,
}

export class BinaryEditorProvider
  implements vscode.CustomEditorProvider<BinaryDocument>
{
  private static readonly viewType = "binary-file-editor.binaryEdit";
  private existingWebViews = new Set<WebViewInfo>();

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    console.log("Editor registered");
    return vscode.window.registerCustomEditorProvider(
      this.viewType,
      new BinaryEditorProvider(context)
    );
  }

  private readonly context: vscode.ExtensionContext;
  private readonly documentChangeEventEmitter = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<BinaryDocument>
  >();

  public readonly onDidChangeCustomDocument =
    this.documentChangeEventEmitter.event;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  saveCustomDocument(
    document: BinaryDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    return document.save(cancellation);
  }

  saveCustomDocumentAs(
    document: BinaryDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    return document.saveAs(destination, cancellation);
  }

  revertCustomDocument(
    document: BinaryDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    return document.revert(cancellation); 
  }

  backupCustomDocument(
    document: BinaryDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Thenable<vscode.CustomDocumentBackup> {
    throw new Error("Method not implemented.");
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<BinaryDocument> {
    const document = await BinaryDocument.create(uri, openContext);

    const webViewListener = document.onContentUpdatedEvent((e: NotifyWebviewMetadata) => {
      for (const webview of this.existingWebViews) {
        if (webview.uri === uri.toString()) {
          console.log(`Sending: ${e.content}`);
          webview.webview.webview.postMessage({ type: "update", value: e.content });
        }
      }
    });

    const vscodeListener = document.onContentChangedEvent((e: NotifyVSCodeMetadata) => {
      this.documentChangeEventEmitter.fire({
        document: document,
        undo: e.undo,
        redo: e.redo,
      });
    });

    document.onDisposeEvent(() => {
      webViewListener.dispose();
      vscodeListener.dispose();
    });

    return document;
  }

  resolveCustomEditor(
    document: BinaryDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      enableCommandUris: false,
      enableForms: false,
    };
    const webViewInfo = {uri: document.uri.toString(), webview: webviewPanel};
    this.existingWebViews.add(webViewInfo);
    webviewPanel.onDidDispose(() => {
      this.existingWebViews.delete(webViewInfo);
    });
    webviewPanel.webview.html = this.generateHTML(webviewPanel.webview);

    const webViewListener = webviewPanel.webview.onDidReceiveMessage((e) =>
      this.handleWebviewMessage(e, document, webviewPanel)
    );
    webviewPanel.onDidDispose(() => webViewListener.dispose());
  }

  private handleWebviewMessage(
    e: any,
    document: BinaryDocument,
    webviewPanel: vscode.WebviewPanel
  ): void {
    switch (e.type) {
      case "ready": {
        console.log("Got ready from webview");
        webviewPanel.webview.postMessage({
          type: "ready-ack",
          value: document.getCurrentDocumentContent(),
        });
        break;
      }
      case "editor-update": {
        console.log("Got update from editor");
        document.makeEdit(e.content);
      }
    }
  }

  private generateHTML(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "binaryEditorWebview.js"
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "binaryEditorWebview.css"
      )
    );
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <link href="${styleUri}" rel="stylesheet" />
        </head>
        <body>
            <div id="editor-content"></div>
            <script src="${scriptUri}"></script>
        </body>
        </html>
    `;
  }
}
