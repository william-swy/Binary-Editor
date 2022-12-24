import * as vscode from "vscode";
import { BinaryDocument, ContentUpdateEventMetadata } from "./binaryDocument";
import { toHex } from "./util";

export class BinaryEditorProvider
  implements vscode.CustomEditorProvider<BinaryDocument>
{
  private static readonly viewType = "binary-file-editor.binaryEdit";

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

  public readonly onDidChangeCustomDocument: vscode.Event<
    vscode.CustomDocumentEditEvent<BinaryDocument>
  > = this.documentChangeEventEmitter.event;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  saveCustomDocument(
    document: BinaryDocument,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    throw new Error("Method not implemented.");
  }

  saveCustomDocumentAs(
    document: BinaryDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    throw new Error("Method not implemented.");
  }

  revertCustomDocument(
    document: BinaryDocument,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    throw new Error("Method not implemented.");
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
    const document = await BinaryDocument.create(uri);
    console.log(`Opened document ${uri}`);

    const listener = document.onContentUpdatedEvent((e) =>
      this.handleDocumentChange(e, document)
    );

    document.onDisposeEvent(() => listener.dispose());

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
    webviewPanel.webview.html = this.generateHTML(webviewPanel.webview);

    const listener = webviewPanel.webview.onDidReceiveMessage((e) =>
      this.handleWebviewMessage(e, document, webviewPanel)
    );
    webviewPanel.onDidDispose(() => listener.dispose());
  }

  private handleDocumentChange(
    e: ContentUpdateEventMetadata,
    document: BinaryDocument
  ) {
    // TODO
  }

  private handleWebviewMessage(
    e: any,
    document: BinaryDocument,
    webviewPanel: vscode.WebviewPanel
  ): void {
    switch (e.type) {
      case "ready": {
        console.log("Got ready from webview");
        console.log(`Document content ${document.content}`);
        webviewPanel.webview.postMessage({
          type: "ready-ack",
          value: toHex(document.content),
        });
        break;
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
