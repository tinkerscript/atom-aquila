const path = require('path');

module.exports = class TemplateEditorView {
  constructor({ filePath }) {
    const { document } = global;

    this._filePath = filePath;
    this.element = document.createElement('div');
    this.element.classList.add('my-package');

    const message = document.createElement('div');
    message.textContent = `filePath: ${filePath}`;
    message.classList.add('message');
    this.element.appendChild(message);
  }

  getTitle() {
    return path.basename(this._filePath);
  }

  serialize() {}

  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }
}
