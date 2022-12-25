import * as vscode from "vscode";
import { debounce, fromHex, splitHexStringToByteChunks, toHex } from "./util";

export interface NotifyVSCodeMetadata {
  undo(): void;
  redo(): void;
}

export interface NotifyWebviewMetadata {
  readonly content: DocumentContent;
}

export interface DocumentContent {
  readonly content: string[];
  readonly valid: boolean;
}

let acceptRejectVal = 0;

export class BinaryDocument implements vscode.CustomDocument {
  uri: vscode.Uri;

  private edits: DocumentContent[];
  private savedEdits: DocumentContent[];

  getCurrentDocumentContent(): DocumentContent {
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

  // TODO: figure out a good cooldown time
  private readonly showInvalidSave = debounce(() => {vscode.window.showWarningMessage("Current content not valid. Saving last valid content.");}, 0)

  static async create(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext) {
    let content;
    console.log(openContext);
    if (openContext.backupId !== undefined) {
      uri = vscode.Uri.parse(openContext.backupId);
      console.log(`Opening ${uri.toString()}`);
      content = new Uint8Array(await vscode.workspace.fs.readFile(uri));
      console.log(content);
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
    console.log(hexContent);
    const hexChunks = splitHexStringToByteChunks(hexContent);
    this.edits = [{content: hexChunks, valid: true}];
    this.savedEdits = [{content: hexChunks, valid: true}];
  }

  dispose(): void {
    this.onDisposeEventEmitter.fire();
    this.onContentUpdatedEmitter.dispose();
    this.onContentChangedEmitter.dispose();
    this.onDisposeEventEmitter.dispose();
  }

  makeEdit(newContent: DocumentContent) {
    console.log(`Added with valid: ${newContent.valid}`);
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
    console.log("Save called");
    // Find the last valid state to save. We do not save invalid states
    if (!this.edits[0].valid) {
      throw new Error("Invariant broken: first edit not valid");
    }
    let contentToSave: DocumentContent = this.edits[0]; // First edit always valid
    for (let i = this.edits.length - 1; i >= 0; i--) {
      if (this.edits[i].valid) {
        contentToSave = this.edits[i];
        if (i !== this.edits.length - 1) {
          this.showInvalidSave();
        }
        break;
      }
    }
    await vscode.workspace.fs.writeFile(target, fromHex(contentToSave.content.join("")));
  }

  async revert(cancellation: vscode.CancellationToken): Promise<void> {
    if (cancellation.isCancellationRequested) {
      return;
    }
    const diskContent = new Uint8Array(await vscode.workspace.fs.readFile(this.uri));
    this.edits = this.savedEdits;
    this.onContentUpdatedEmitter.fire({
      content: {content: splitHexStringToByteChunks(toHex(diskContent)), valid: true}
    });
  }

  // Unlike saving where invalid data results in a failed save, if the content is invalid, the content
  // will still be saved in the 
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
