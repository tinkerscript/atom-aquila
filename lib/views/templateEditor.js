const path = require('path');

const HEIGHT = 100;
const LINE_HEIGHT = 20;
const COUNT = Math.floor(HEIGHT/LINE_HEIGHT);
console.log(COUNT)
module.exports = class TemplateEditorView {
  constructor({ filePath }) {
    const { document } = global;

    this._filePath = filePath;
    this.element = document.createElement('div');
    this.element.classList.add('atom-aquila');

    const tree = document.createElement('div');
    this.element.appendChild(tree);
    this._tree = tree;

    this._model = {
      top: 0,
      count: COUNT,
      template: {
        type: 'Form',
        expanded: true,
        items: [{
          type: 'Layout',
          expanded: false,
          items: [{
            type: 'Group'
          }, {
            type: 'Group'
          }]
        }, {
          type: 'ToolBar',
          expanded: false,
          items: [{
            type: 'Tool',
            expanded: false,
            items: [{
              type: 'Tool'
            }]
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

  render({ selected } = {}) {
    const { document } = global;
    const viewModel = this._createViewModel(this._model);
    this._tree.innerHTML = '';

    viewModel.forEach(({ expanded, id, level, type }) => {
      const div = document.createElement('div');
      let leftMargin = level;

      div.addEventListener('click', () => {
        const id = div.getAttribute('data-aquila-id');
        const { item } = (this._plain || [])[id] || {};
        if (item.expanded != null) {
          item.expanded = !item.expanded;
        }
        this.render({ selected: id });
      });

      if (selected != null && id == selected) {
        div.classList.add('atom-aquila-tree-item_selected');
      }

      div.classList.add('icon');
      if (expanded === true) {
        div.classList.add('icon-chevron-down');
      } else if (expanded === false) {
        div.classList.add('icon-chevron-right');
      } else {
        div.classList.add('icon-file-text');
      }

      div.classList.add('atom-aquila-tree-item');
      div.setAttribute('data-aquila-id', id);
      div.style['margin-left'] = `${leftMargin}em`;
      div.textContent = `${type}`;
      this._tree.appendChild(div);
    });
  }

  _createViewModel({ template = {}, top, count }) {
    const min = top,
      max = top + count;
    const plain = [];
    let counter = 0;

    const iterate = (item, parent, level = 0) => {
      const { items, expanded } = item;

      if (counter >= min && counter < max) {
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
