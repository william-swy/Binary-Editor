// vscode cannot be visible in global scope
(function () {
  const vscode = acquireVsCodeApi();

  const hexRegex = /^[0-9a-f]$/;

  function isValidHex(str) {
    return hexRegex.test(str);
  }

  window.addEventListener(
    "keydown",
    function (e) {
      console.log(`key ${e.key} pressed`);
      if (e.target.className === "table-entry") {
        if (
          !isValidHex(e.key) &&
          e.key !== "ArrowRight" &&
          e.key !== "ArrowLeft" &&
          e.key !== "ArrowUp" &&
          e.key !== "ArrowDown" &&
          e.key !== "Backspace"
        ) {
          console.log("Canceled");
          e.preventDefault();
          return false;
        }
      }
      if (fileContent.isOnTopRow() && e.key === "ArrowUp") {
        e.preventDefault();
        return false;
      }
      if (fileContent.isOnBottomRow() && e.key === "ArrowDown") {
        e.preventDefault();
        return false;
      }
      console.log("Not cancelled");
    },
    true
  );

  function paddedHex(number, totalSize) {
    let hex = Number(number).toString(16);
    while (hex.length < totalSize) {
      hex = "0" + hex;
    }
    return hex;
  }

  function setCursorAtPos(elem, pos) {
    setTimeout(() => {
      let range = document.createRange();
      range.setStart(elem.childNodes[0], pos);
      range.collapse(false);
      let sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      elem.focus();
    }, 0);
  }

  class FileContent {
    constructor() {
      this.content = ["&nbsp"];
      this.bytesPerRow = 8;
      this.focusCellIdx = 0;
      this.disableValidation = false;
    }

    isOnBottomRow() {
      const totalRows = Math.ceil(this.content.length / this.bytesPerRow);
      const rowIdx = Math.ceil(this.focusCellIdx / this.bytesPerRow);
      return rowIdx === totalRows;
    }

    isOnTopRow() {
      return this.focusCellIdx < this.bytesPerRow;
    }

    providerUpdate(hexString) {
      console.log(hexString);
      if (hexString.length % 2 !== 0) {
        throw new Error("hexString length not multiple of two");
      }
      if (hexString.length === 0) {
        this.content = ["&nbsp"];
      } else {
        let updatedContent = [];
        let processedChars = 0;
        while (processedChars + 2 <= hexString.length) {
          const byteVal = hexString.slice(processedChars, processedChars + 2);
          processedChars += 2;
          updatedContent.push(byteVal);
        }
        this.content = updatedContent;
      }
      this.render();
    }

    removeEntry(idx) {
      this.content.splice(idx, 1);
      if (this.content.length === 0) {
        this.content = ["&nbsp"];
        console.log("Remove results in empty");
      }
      this.render();
      this.updateProvider();
    }

    // REQUIRES entry to be a string that is a hex representation of two bytes
    addEntriesAt(idx, entries) {
      const elem1 = entries.slice(0, 2);
      const elem2 = entries.slice(2, 4);
      this.content.splice(idx, 1, elem1, elem2);
      this.render();
      this.updateProvider();
    }

    setEntry(idx, entry) {
      if (this.content[idx] !== entry) {
        this.content[idx] = entry;
        this.render();
        this.updateProvider();
      }
    }

    updateProvider() {
      if (this.content.length === 1) {
        vscode.postMessage({ type: "editor-update", content: "" });
      } else {
        vscode.postMessage({
          type: "editor-update",
          content: this.content.join(""),
        });
      }
    }

    render() {
      document.getElementById("editor-content").innerHTML = this.generateHTML();
      // attach listeners
      for (let i = 0; i < this.content.length; i++) {
        let elem = document.getElementById(`table-entry-${i + 1}`);
        elem.addEventListener("blur", () => this.handleCompleteEditCell(i));
        elem.addEventListener("keydown", (event) =>
          this.handleKeyPress(i, event)
        );
        elem.addEventListener("focus", () => {
          this.focusCellIdx = i;
        });
      }
    }

    handleCompleteEditCell(idx) {
      // Since inputs are constrained to hex values we just need to check
      // the length is size of a byte
      if (idx >= this.content.length) {
        return;
      }
      let elem = document.getElementById(`table-entry-${idx + 1}`);

      if (!this.disableValidation) {
        console.log("validation called");
        console.log(`idx: ${idx}`);
        console.log(`inner text ${elem.innerText}`);
        if (elem.innerText.length === 2) {
          console.log("valiation is valid");
          this.setEntry(idx, elem.innerText);
        } else if (elem.innerText === String.fromCharCode(160)) {
          console.log("validation is valid");
          this.setEntry(idx, "&nbsp");
        } else {
          vscode.postMessage({ type: "invalid-input", input: elem.innerText });
          console.log(
            `Invalid value: ${elem.innerText}, has length ${elem.innerText.length}`
          );
          elem.innerText = this.content[idx];
        }
      }

      if (this.content.length === 1) {
        setTimeout(() => {
          elem.focus();
        }, 20);
      }
    }

    handleKeyPress(idx, event) {
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      let elem = document.getElementById(`table-entry-${idx + 1}`);
      // We already restrained the input
      const cursorPos = window.getSelection().getRangeAt(0).startOffset;
      if (event.key === "ArrowRight") {
        if (
          cursorPos === elem.innerText.length &&
          idx + 1 < this.content.length
        ) {
          let nextElem = document.getElementById(`table-entry-${idx + 2}`);
          setCursorAtPos(nextElem, 0);
        }
      } else if (event.key === "ArrowLeft") {
        if (cursorPos === 0 && idx > 0) {
          let prevElem = document.getElementById(`table-entry-${idx}`);
          setCursorAtPos(prevElem, 2);
        }
      } else if (event.key === "ArrowUp") {
        const cellAboveIdx = idx - this.bytesPerRow;
        if (cellAboveIdx >= 0) {
          let aboveElem = document.getElementById(
            `table-entry-${cellAboveIdx + 1}`
          );
          setCursorAtPos(aboveElem, Math.min(2, cursorPos));
        }
      } else if (event.key === "ArrowDown") {
        const cellBelowIdx = idx + this.bytesPerRow;
        if (cellBelowIdx < this.content.length) {
          let belowElem = document.getElementById(
            `table-entry-${cellBelowIdx + 1}`
          );
          setCursorAtPos(belowElem, Math.min(2, cursorPos));
        } else {
          let belowElem = document.getElementById(
            `table-entry-${this.content.length}`
          );
          setCursorAtPos(belowElem, 2);
        }
      } else if (event.key === "Backspace") {
        if (elem.innerText.length === 1 && cursorPos === 1) {
          // Since removeEntry unfocus then focus, this will trigger validation callback which will
          // automatically fail
          this.disableValidation = true;
          this.removeEntry(idx);

          if (idx === 0) {
            let elem = document.getElementById(`table-entry-${1}`);
            setCursorAtPos(elem, 0);
          } else {
            let elem = document.getElementById(`table-entry-${idx}`);
            setCursorAtPos(elem, 2);
          }
          this.disableValidation = false;
        }
      } else {
        const newVal = elem.innerText + event.key;
        console.log(newVal);
        if (newVal.length > 4) {
          throw new Error("Cell length too long. In bad state");
        }
        if (newVal.length === 4) {
          // Since addEntries unfocus then focus, this will trigger validation callback which will
          // automatically fail
          this.disableValidation = true;
          this.addEntriesAt(idx, newVal);
          let newElem = document.getElementById(`table-entry-${idx + 2}`);
          setCursorAtPos(newElem, 2);
          this.disableValidation = false;
        }
      }
    }

    generateHTML() {
      const totalRows = Math.ceil(this.content.length / this.bytesPerRow);
      let elementsProcessed = 0;
      let html = '<table id="editor-table">';
      for (let row = 0; row < totalRows; row++) {
        html += "<tr>";
        html += `<td class="table-address">${paddedHex(
          row * this.bytesPerRow,
          8
        )}</td>`;
        for (let elem = 0; elem < this.bytesPerRow; elem++) {
          if (elementsProcessed < this.content.length) {
            const byteHex = this.content[elementsProcessed];
            elementsProcessed++;
            html += `<td class="table-entry" contenteditable='true' id=table-entry-${elementsProcessed}>${byteHex}</td>`;
          }
        }
      }
      html += "</table>";
      return html;
    }
  }

  const fileContent = new FileContent();

  window.addEventListener("message", async (e) => {
    const recvData = e.data;
    switch (recvData.type) {
      case "ready-ack": {
        console.log("Got ready-ack");
        fileContent.providerUpdate(recvData.value);
        break;
      }
      case "update": {
        fileContent.providerUpdate(recvData.value);
        break;
      }
    }
  });

  vscode.postMessage({ type: "ready" });
})();
