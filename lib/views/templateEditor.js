const path = require('path');

module.exports = class TemplateEditorView {
  constructor({ filePath }) {
    const { document } = global;

    this._filePath = filePath;
    this.element = document.createElement('div');
    this.element.classList.add('my-package');

    const tree = document.createElement('div');
    this.element.appendChild(tree);
    this._tree = tree;

    this._model = {
      top: 0,
      count: 5,
      template: {
        type: 'Form',
        expanded: true,
        items: [{
          type: 'Layout',
          items: [{
            type: 'Group'
          }, {
            type: 'Group'
          }]
        }, {
          type: 'ToolBar',
          items: [{
            type: 'Tool'
          }, {
            type: 'Tool'
          }, {
            type: 'Tool'
          }]
        }]
      }
    };

    this.render();
  }

  render() {
    const { document } = global;
    const viewModel = this._createViewModel(this._model);

    this._tree.innerHTML = '';

    viewModel.forEach(({ expanded, id, level, type }) => {
      const div = document.createElement('div');
      let char = ' ';

      if (expanded === true) {
        char = '-';
      } else if (expanded === false) {
        char = '+';
      }

      div.addEventListener('click', () => {
        const id = div.getAttribute('data-aquila-id');
        const { item } = (this._plain || [])[id] || {};
        item.expanded = !item.expanded;
        this.render();
      });

      div.setAttribute('data-aquila-id', id);
      div.textContent = `${'__'.repeat(level)}${char}${type}`;
      this._tree.appendChild(div);
    });
  }

  _createViewModel({ template = {}, top, count }) {
    const min = top, max = top + count;
    const plain = [];
    let counter = 0;

    const iterate = (item, parent, level = 0) => {
      const { items, expanded } = item;

      if (counter >= min && counter <= max) {
        plain.push({ item, parent, level });
      }

      if (counter > max) {
        return true;
      }

      counter++;

      return (expanded && items || []).some(child => {
        iterate(child, item, level + 1);
      });
    };

    iterate(template);
    this._plain = plain;

    return plain.map(({ item, level }, id) => {
      return Object.assign({}, item, { id, level });
    });
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
