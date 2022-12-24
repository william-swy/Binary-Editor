import * as vscode from "vscode";
import { fromHex, toHex } from "./util";

export interface NotifyVSCodeMetadata {
  undo(): void;
  redo(): void;
}

export interface NotifyWebviewMetadata {
  readonly content: String;
}

export class BinaryDocument implements vscode.CustomDocument {
  uri: vscode.Uri;

  private edits: String[];
  private savedEdits: String[];

  getCurrentDocumentContent(): String {
    if (this.edits.length === 0) {
      throw new Error("Length of edit history should not be empty");
    }
    return this.edits[this.edits.length-1];
  }

  private readonly onContentUpdatedEmitter =
    new vscode.EventEmitter<NotifyWebviewMetadata>();
  public readonly onContentUpdatedEvent = this.onContentUpdatedEmitter.event; // Notify webviews

  private readonly onContentChangedEmitter =
    new vscode.EventEmitter<NotifyVSCodeMetadata>();
  public readonly onContentChangedEvent = this.onContentChangedEmitter.event; // Notifies VSCode

  private readonly onDisposeEventEmitter = new vscode.EventEmitter<void>();
  public readonly onDisposeEvent = this.onDisposeEventEmitter.event;

  static async create(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext) {
    let content;
    if (openContext.backupId !== undefined) {
      uri = vscode.Uri.parse(openContext.backupId);
      content = new Uint8Array(await vscode.workspace.fs.readFile(uri));
    } else if (uri.scheme === "untitled") {
      if (openContext.untitledDocumentData !== undefined) {
        content = openContext.untitledDocumentData;
      } else {
        content = new Uint8Array();
      }
    } else {
      content = new Uint8Array(await vscode.workspace.fs.readFile(uri));
    }
    return new BinaryDocument(uri, content);
  }

  private constructor(uri: vscode.Uri, content: Uint8Array) {
    this.uri = uri;
    const hexContent = toHex(content);
    this.edits = [hexContent];
    this.savedEdits = [hexContent];
  }

  dispose(): void {
    this.onDisposeEventEmitter.fire();
    this.onContentUpdatedEmitter.dispose();
    this.onContentChangedEmitter.dispose();
    this.onDisposeEventEmitter.dispose();
  }

  makeEdit(newContent: String) {
    this.edits.push(newContent);

    this.onContentChangedEmitter.fire({
      undo: async () => {
        this.edits.pop();
        this.onContentUpdatedEmitter.fire({
          content: this.getCurrentDocumentContent(),
        });
      },
      redo: async () => {
        this.edits.push(newContent);
        this.onContentUpdatedEmitter.fire({
          content: this.getCurrentDocumentContent(),
        });
      },
    });
  }

  async save(cancellation: vscode.CancellationToken) {
    await this.saveAs(this.uri, cancellation);
    this.savedEdits = Array.from(this.edits);
  }

  async saveAs(target: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
    if (cancellation.isCancellationRequested) {
      return;
    }
    await vscode.workspace.fs.writeFile(target, fromHex(this.edits[this.edits.length-1]));
  }

  async revert(cancellation: vscode.CancellationToken): Promise<void> {
    if (cancellation.isCancellationRequested) {
      return;
    }
    const diskContent = new Uint8Array(await vscode.workspace.fs.readFile(this.uri));
    this.edits = this.savedEdits;
    this.onContentUpdatedEmitter.fire({
      content: toHex(diskContent)
    });
  }

  async backup(dest: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    await this.saveAs(dest, cancellation);

    return {
      id: dest.toString(),
      delete: async () => {
        try {
          vscode.workspace.fs.delete(dest);
        } catch {

        }
      }
    };
  }
}
