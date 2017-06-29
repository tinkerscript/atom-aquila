/* global atom */

const path = require('path');
const scrollbar = require('perfect-scrollbar');
const template = require('./testTemplate.js')

const LINE_HEIGHT = 22;

module.exports = class TemplateEditorView {
  constructor({ filePath }) {
    const { document } = global;

    this._filePath = filePath;
    this.element = document.createElement('div');
    this.element.classList.add('atom-aquila');

    const tree = document.createElement('div');
    tree.classList.add('atom-aquila-tree');

    const scroll = document.createElement('div');
    scroll.classList.add('atom-aquila-scroll');
    scroll.classList.add('always-visible');

    const scrollContent = document.createElement('div');

    this.element.appendChild(tree);
    this.element.appendChild(scroll);
    scroll.appendChild(scrollContent);

    this._tree = tree;
    this._scroll = scroll;
    this._scrollContent = scrollContent;
    this._model = {
      top: 0,
      count: this._getMaxItemsCount(),
      template
    };

    this.render();

    scrollbar.initialize(scroll);

    scroll.addEventListener('ps-scroll-y', () => {
      const scrollPosition = scroll.scrollTop;
      const topNode = this._calcTopNode({ scrollPosition });
      if (this._model.top !== topNode) {
        this._model.top = topNode;
        this.render();
      }
    });

    this._tree.addEventListener('wheel', ({ deltaY }) => {
      scroll.scrollTop += deltaY;
      const scrollPosition = scroll.scrollTop;
      const topNode = this._calcTopNode({ scrollPosition });
      if (this._model.top !== topNode) {
        this._model.top = topNode;
        this.render();
      }
    })
  }

  _getWindowHeight(){
    return atom.workspace.getActiveTextEditor().element.offsetHeight;
  }

  _getMaxItemsCount(){
    return Math.floor(this._getWindowHeight() / LINE_HEIGHT);
  }

  _getExpandedCount() {
    let result = 0;

    const iterateViewItem = ({ expanded, items}) => {
      result ++;
      if(expanded){
        items.forEach(iterateViewItem);
      }
    }
    iterateViewItem(this._model.template);
    return result;
  }

  _calcTopNode({ scrollPosition }) {
    return Math.floor(scrollPosition / LINE_HEIGHT);
  }

  _getScrollContentHeight() {
    const indent = 20;
    return this._getExpandedCount() * LINE_HEIGHT + indent;
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

    this._scrollContent.style.height = this._getScrollContentHeight() + 'px';
    scrollbar.update(this._scroll);
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
