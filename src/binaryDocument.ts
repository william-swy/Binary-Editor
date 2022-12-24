import * as vscode from "vscode";

export interface ContentUpdateEventMetadata {
  readonly content: Uint8Array;
  undo(): void;
  redo(): void;
}

export class BinaryDocument implements vscode.CustomDocument {
  uri: vscode.Uri;
  content: Uint8Array;

  private readonly onContentUpdatedEmitter: vscode.EventEmitter<ContentUpdateEventMetadata> =
    new vscode.EventEmitter<ContentUpdateEventMetadata>();
  public readonly onContentUpdatedEvent: vscode.Event<ContentUpdateEventMetadata> =
    this.onContentUpdatedEmitter.event;

  private readonly onDisposeEventEmitter: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDisposeEvent: vscode.Event<void> =
    this.onDisposeEventEmitter.event;

  static async create(uri: vscode.Uri) {
    let content;
    if (uri.scheme === "untitled") {
      content = new Uint8Array();
    } else {
      content = new Uint8Array(await vscode.workspace.fs.readFile(uri));
    }
    return new BinaryDocument(uri, content);
  }

  private constructor(uri: vscode.Uri, content: Uint8Array) {
    this.uri = uri;
    this.content = content;
  }

  dispose(): void {
    this.onDisposeEventEmitter.fire();
    this.onContentUpdatedEmitter.dispose();
    this.onDisposeEventEmitter.dispose();
  }
}
