function splitToChunk(str, chunkSize) {
    const numChunks = Math.ceil(str.length / chunkSize);
    const chunks = new Array(numChunks);
  
    for (let i = 0, o = 0; i < numChunks; ++i, o += chunkSize) {
      chunks[i] = str.substr(o, chunkSize);
    }

    return chunks;
}

function paddedHexString(number, totalSize) {
    let hex = Number(number).toString(16);
    while (hex.length < totalSize) {
      hex = "0" + hex;
    }
    return hex;
}

function getCursorOffset() {
    return window.getSelection().getRangeAt(0).startOffset;
}

function setCursorAtPos(elem, pos) {
    setTimeout(() => {
    if (elem.childNodes[0] !== undefined) {
        // Handle empty case
        let range = document.createRange();
        range.setStart(elem.childNodes[0], pos);
        range.collapse(false);
        let sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }    
    elem.focus();
    }, 0);
}

const emptyCellValue = "";

class EditorDisplay {
    constructor(containerID, updateCallback) {
        this.containerID = containerID;
        this.bytesPerRow = 8;
        this.focusCellIdx = 0;
        this.content = [emptyCellValue];
        this.updateCallback = updateCallback;
        this.cursorUpdatePos = undefined;
    }

    updateContents(byteStringList) {
        if (byteStringList.length === 0) {
            this.content = [emptyCellValue];
        } else {
            this.content = byteStringList;
        }
        this._renderContents();

        this._updateCursor();
    }

    _getDOMForCell(cellIdx) {
        return document.getElementById(`table-entry-${cellIdx}`);
    }

    _renderContents() {
        document.getElementById(this.containerID).innerHTML = this._generateHTML();
        for (let i = 0; i < this.content.length; i++) {
            let elem = this._getDOMForCell(i);
            elem.addEventListener("input", (event) => this._handleInput(event, i));
        }
    }

    _generateHTML() {
        let html = "<table id='editor-display'>";
        const totalRows = Math.ceil(this.content.length / this.bytesPerRow);
        let elementsProcessed = 0;
        for (let row = 0; row < totalRows; row++) {
            html += "<tr>";
            html += `<td class="table-address">${paddedHexString(row * this.bytesPerRow, 8)}`;
            for (let elem = 0; elem < this.bytesPerRow; elem++) {
                if (elementsProcessed < this.content.length) {
                    const byteHex = this.content[elementsProcessed];
                    html += `<td class="table-entry" contenteditable="true" id="table-entry-${elementsProcessed}">${byteHex}</td>`;
                    elementsProcessed++;
                }
            }
            html += "</tr>";
        }
        html += "</table>";
        return html;
    }

    _updateCursor() {
        if (this.cursorUpdatePos === undefined) {
            return;
        }

        const cellIdx = this.cursorUpdatePos.cellIdx;
        const offset = this.cursorUpdatePos.offset;

        if (cellIdx >= this.content.length) {
            return;
        }

        let item = this._getDOMForCell(cellIdx);
        if (offset > item.innerText.length + 1) {
            return;
        }

        setCursorAtPos(item, offset);

        this.cursorUpdatePos = undefined;
    }

    _removeCell(cellIdx) {
        if (cellIdx < this.content.length) {
            // If state is "empty" don't do anything
            if (this.content.length === 1 && this.content[0] === emptyCellValue) {
                return;
            }
            this.content.splice(cellIdx, 1);
            if (this.content.length === 0) {
                this.content = [emptyCellValue];
                this._setCursorPos(0, 0);
                this.updateCallback([]);
            } else {
                if (this.content.length === 1) {
                    this._setCursorPos(0, this.content[0].length);
                } else {
                    this._setCursorPos(cellIdx - 1, this.content[cellIdx - 1].length);
                }
                this.updateCallback(this.content);
            }
        }
    }

    _splitCell(cellIdx, content) {
        const splittedContent = splitToChunk(content, 2);
        this.content.splice(cellIdx, 1, ...splittedContent);
        this._setCursorPos(cellIdx + splittedContent.length - 1, splittedContent[splittedContent.length - 1].length);
        this.updateCallback(this.content);
    }

    _updateCell(cellIdx, content) {
        const currOffset = getCursorOffset();
        this.content[cellIdx] = content;
        this._setCursorPos(cellIdx, Math.min(content.length, currOffset));
        this.updateCallback(this.content);
    }

    _setCursorPos(cellIdx, offset) {
        this.cursorUpdatePos = {
            cellIdx: cellIdx,
            offset: offset,
        };
    }

    _handleInput(event, cellIdx) {
        console.log(event.target.innerText);
        const updatedContent = event.target.innerText;
        
        if (updatedContent === this.content[cellIdx]) {
            return;
        }

        if (updatedContent === emptyCellValue) {
            this._removeCell(cellIdx);
        } else if (updatedContent.length > 2) {
            this._splitCell(cellIdx, updatedContent);
        } else {
            this._updateCell(cellIdx, updatedContent);
        }
    }
}