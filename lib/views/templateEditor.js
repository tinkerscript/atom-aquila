/* global atom */

const path = require('path');
const scrollbar = require('perfect-scrollbar');
const template = require('./testTemplate.js')

const LINE_HEIGHT = 22;

const getVisibleItemsCount = () => {
  const editorHeight = atom.workspace.getActiveTextEditor().element.offsetHeight;
  return Math.floor(editorHeight / LINE_HEIGHT);
}
const getScrollContentHeight = template => {
  const indent = 20;
  let expandedCount = 0;

  const iterateViewItem = ({ expanded, items }) => {
    expandedCount++;
    if (expanded) {
      items.forEach(iterateViewItem);
    }
  }
  iterateViewItem(template);

  return expandedCount * LINE_HEIGHT + indent + 'px';
}

module.exports = class TemplateEditorView {
  constructor({ filePath }) {
    this._filePath = filePath;
    const { document } = global;

    this.element = document.createElement('div');
    this.element.classList.add('atom-aquila');

    this._model = {
      top: 0,
      count: getVisibleItemsCount(),
      template,
      selected: 0
    };

    this.treeInitialize();
    this.gridInitialize();
  }

  gridInitialize(){
    const { document } = global;
    const grid = document.createElement('div');
    grid.classList.add('atom-aquila-grid');
    this._grid = grid;
    this.element.appendChild(grid);
  }

  renderGrid(viewItem, editedProperty){
    const { document } = global;
    this._grid.innerHTML = '';

    const table = document.createElement('table');

    Object.keys(viewItem.properties || {}).forEach( key => {
      const property = viewItem.properties[key];

      const tr = document.createElement('tr');
      table.appendChild(tr);

      const tdLeft = document.createElement('td');
      tdLeft.classList.add('atom-aquila-cell');
      tdLeft.textContent = key;
      tr.appendChild(tdLeft);

      const tdRight = document.createElement('td');
      tdRight.classList.add('atom-aquila-cell');
      tdRight.textContent = property;
      tr.appendChild(tdRight);

      if (key == editedProperty){
        tdRight.innerHTML = `<input type="text" class="input" value="${property}" />`;
      }

      tdRight.addEventListener('click', () => {
        if(editedProperty != key){
          this.renderGrid(viewItem, key);
        }
      });
    });

    this._grid.appendChild(table);
  }

  treeInitialize(){
    const { document } = global;

    const tree = document.createElement('div');
    tree.classList.add('atom-aquila-tree');

    const scroll = document.createElement('div');
    scroll.classList.add('atom-aquila-scroll');

    const scrollContent = document.createElement('div');

    const scrollHandler = () => {
      const scrollPosition = scroll.scrollTop;
      const topNode = Math.floor(scrollPosition / LINE_HEIGHT);
      if (this._model.top !== topNode) {
        this._model.top = topNode;
        this.renderTree();
      }
    };

    this.element.appendChild(tree);
    this.element.appendChild(scroll);
    scroll.appendChild(scrollContent);

    this._tree = tree;
    this._scroll = scroll;
    this._scrollContent = scrollContent;

    this.renderTree();

    scrollbar.initialize(scroll);

    scroll.addEventListener('ps-scroll-y', () => {
      scrollHandler();
    });

    this._tree.addEventListener('wheel', ({ deltaY }) => {
      scroll.scrollTop += deltaY;
      scrollHandler();
    });
  }

  renderTree() {
    const { document } = global;
    const viewModel = this._createViewModel(this._model);
    this._viewModel = viewModel;
    this._tree.innerHTML = '';

    viewModel.forEach(({ expanded, id, level, type, isSelected }) => {
      const div = document.createElement('div');
      let leftMargin = level;

      div.addEventListener('click', () => {
        const id = div.getAttribute('data-aquila-id');
        const { item } = viewModel.find(x => x.id == id);
        if (item.expanded != null) {
          item.expanded = !item.expanded;
        }
        this._model.selected = id;
        this.renderGrid(item)
        this.renderTree();
      });

      if (isSelected) {
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

    this._scrollContent.style.height = getScrollContentHeight(this._model.template);
    scrollbar.update(this._scroll);
  }

  _createViewModel({ template = {}, top, count, selected }) {
    const min = top,
      max = top + count;
    const plain = [];
    let counter = 0;

    const iterate = (item, parent, level = 0) => {
      const { items, expanded } = item;
      if (counter >= min && counter < max) {
        const isSelected = selected == counter;
        plain.push(Object.assign({}, item, {
          item,
          parent,
          level,
          id: counter,
          isSelected
        }));
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
    return plain;
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
