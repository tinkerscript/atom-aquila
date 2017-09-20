/* global atom */

const { registerOrUpdateElement } = require('atom-utils')
const scrollbar = require('perfect-scrollbar');
const elementResizeDetector = require('element-resize-detector')({
  strategy: 'scroll'
});

const LINE_HEIGHT = 22;
const BETWEEN_HEIGHT = 5;

const getVisibleItemsCount = () => {
  const editorHeight = atom.workspace.getCenter().paneContainer.element.getElementsByClassName('item-views')[0].offsetHeight;
  return Math.floor(editorHeight / LINE_HEIGHT);
}

const getScrollContentHeight = template => {
  let visibleRowsCount = 0;
  let expandedCount = 0;

  const iterateViewItem = ({ expanded, items }) => {
    visibleRowsCount++;
    if (expanded) {
      expandedCount ++;
      items.forEach(iterateViewItem);
    }
  }
  iterateViewItem(template);
  return visibleRowsCount * (LINE_HEIGHT + BETWEEN_HEIGHT)
    + expandedCount * BETWEEN_HEIGHT + 'px';
}


class Element {
  static initClass() {
    return registerOrUpdateElement('atom-aquila', { class: this });
  }

  _initGrid() {
    const { document } = global;
    const grid = document.createElement('div');
    grid.classList.add('atom-aquila-grid');
    this._grid = grid;
    this.appendChild(grid);
  }

  _renderGrid(viewItem) {
    const { document } = global;
    this._grid.innerHTML = '';

    const table = document.createElement('table');
    const controlProperties = this._model.getDefaultProperties(viewItem.type);
    this._grid.appendChild(table);

    Object.keys(controlProperties || {}).forEach(key => {
      let property = viewItem.properties[key];

      const tr = document.createElement('tr');
      table.appendChild(tr);

      const tdLeft = document.createElement('td');
      tdLeft.classList.add('atom-aquila-cell');
      tdLeft.textContent = key;
      tr.appendChild(tdLeft);

      const tdRight = document.createElement('td');
      tdRight.classList.add('atom-aquila-cell');
      tdRight.classList.add('atom-aquila-right-cell');
      tr.appendChild(tdRight);

      if (property == null) {
        property = controlProperties[key].value;
      } else {
        tr.classList.add('atom-aquila-bolder');
      }

      const input = document.createElement('input');
      tdRight.appendChild(input);
      input.classList.add('native-key-bindings');
      input.setAttribute('type', 'text');

      if (property != null) {
        input.setAttribute('value', property);
        const length = property.toString().length;
        input.setSelectionRange(length, length);
      }

      const onChange = () => {
        const { value } = input;
        if (property != value) {
          this._model.updateViewItem({
            viewItem,
            propertyName: key,
            value
          });
        }
      };
      input.addEventListener('keypress', (e) => {
        if ((e.keyCode === 13) || (e.keyCode == 83 && e.ctrlKey)) {
          console.log('on custom keypress')
          e.preventDefault();
          onChange();
        }
      });

      input.addEventListener('focusout', onChange);
    });
  }

  _initTree() {
    const { document } = global;

    const tree = document.createElement('div');
    tree.classList.add('atom-aquila-tree');

    const scroll = document.createElement('div');
    scroll.classList.add('atom-aquila-scroll');

    const scrollContent = document.createElement('div');

    const scrollHandler = () => {
      const scrollPosition = scroll.scrollTop;
      let height = 0;
      let topNode = 0;

      const iterateViewItem = ({ expanded, items }) => {
        if (height >= scrollPosition) {
          return true;
        }
        topNode ++;
        height += LINE_HEIGHT + BETWEEN_HEIGHT;
        if (expanded) {
          height += BETWEEN_HEIGHT;
          items.some(iterateViewItem);
        }
      }
      iterateViewItem(this._model.template);

      if (this._model.top !== topNode) {
        this._model.top = topNode;
        this._renderTree();
      }
    };

    this.appendChild(tree);
    this.appendChild(scroll);
    scroll.appendChild(scrollContent);

    this._tree = tree;
    this._scroll = scroll;
    this._scrollContent = scrollContent;

    this._renderTree();

    scrollbar.initialize(scroll);

    scroll.addEventListener('ps-scroll-y', () => {
      scrollHandler();
    });

    this._tree.addEventListener('wheel', ({ deltaY }) => {
      scroll.scrollTop += deltaY;
      scrollHandler();
    });

    this._model.changed.add(() => {
      this._renderTree();
    });
  }

  _renderTree() {
    const { document } = global;
    const viewModel = this._model.createViewModel();
    this.viewModel = viewModel;
    this._tree.innerHTML = '';
    let dragedItem;

    viewModel.forEach( viewModelItem => {
      const { id, level, isSelected, item, parent } = viewModelItem;
      const { expanded, type } = item;
      const itemDiv = document.createElement('div');
      const afterDiv = document.createElement('div');
      let leftMargin = level;

      itemDiv.addEventListener('click', () => {
        const id = itemDiv.getAttribute('data-aquila-id');
        const { item } = viewModel.find(x => x.id == id);
        if (item.expanded != null) {
          item.expanded = !item.expanded;
        }
        this._model.selected = id;
        this._renderGrid(item)
        this._renderTree();
      });

      itemDiv.addEventListener('dragover', () => {
        itemDiv.classList.add('atom-aquila-tree-item_selected');
      });
      itemDiv.addEventListener('dragleave', () => {
        itemDiv.classList.remove('atom-aquila-tree-item_selected');
      });
      afterDiv.addEventListener('dragover', () => {
        afterDiv.classList.add('atom-aquila-tree-between-over');
      });
      afterDiv.addEventListener('dragleave', () => {
        afterDiv.classList.remove('atom-aquila-tree-between-over');
      });

      itemDiv.addEventListener('drag', () => {
        dragedItem = viewModelItem;
      });

      itemDiv.addEventListener('drop', () => {
        itemDiv.classList.remove('atom-aquila-tree-item_selected');
        this._model.moveToBottom({
          targetParent: item,
          movedItem: dragedItem.item,
          movedParent: dragedItem.parent
        });
        this._renderTree();
      });

      afterDiv.addEventListener('drop', () => {
        afterDiv.classList.add('atom-aquila-tree-between-over');
        this._model.moveAfterItem({
          targetItem: item,
          movedItem: dragedItem.item,
          targetParent: parent,
          movedParent: dragedItem.parent
        });
        this._renderTree();
      });


      if (isSelected) {
        itemDiv.classList.add('atom-aquila-tree-item_selected');
      }

      itemDiv.classList.add('icon');
      if (expanded === true) {
        itemDiv.classList.add('icon-chevron-down');
      } else if (expanded === false) {
        itemDiv.classList.add('icon-chevron-right');
      } else {
        itemDiv.classList.add('icon-file-text');
      }

      afterDiv.classList.add('atom-aquila-tree-between');
      afterDiv.style['margin-left'] = `${leftMargin}em`;

      itemDiv.classList.add('atom-aquila-tree-item');
      itemDiv.classList.add(`aquila-control`);
      itemDiv.setAttribute('data-aquila-id', id);
      itemDiv.setAttribute('draggable', true);
      itemDiv.style['margin-left'] = `${leftMargin}em`;
      itemDiv.textContent = `${type}`;

      if(parent && parent.items.indexOf(item) == 0) {
        const beforeDiv = document.createElement('div');
        beforeDiv.classList.add('atom-aquila-tree-between');
        beforeDiv.style['margin-left'] = `${leftMargin}em`;

        beforeDiv.addEventListener('dragover', () => {
          beforeDiv.classList.add('atom-aquila-tree-between-over');
        });
        beforeDiv.addEventListener('dragleave', () => {
          beforeDiv.classList.remove('atom-aquila-tree-between-over');
        });

        beforeDiv.addEventListener('drop', () => {
          beforeDiv.classList.add('atom-aquila-tree-between-over');
          this._model.moveToTop({
            movedItem: dragedItem.item,
            targetParent: parent,
            movedParent: dragedItem.parent
          });
          this._renderTree();
        });
        this._tree.appendChild(beforeDiv);
      }
      this._tree.appendChild(itemDiv);

      this._tree.appendChild(afterDiv);
    });

    this._scrollContent.style.height = getScrollContentHeight(this._model.template);
    scrollbar.update(this._scroll);
  }

  getModel() {
    return this._model;
  }

  setModel(model) {
    this._model = model;
    this._model.count = getVisibleItemsCount();

    this._model.loadTemplate().then(() => {
      elementResizeDetector.listenTo(this, () => {
        this._renderTree();
      });
      this.classList.add('atom-aquila');
      this._initTree();
      this._initGrid();

      this._model.changed.add(() => {
        this._renderTree();
      });
    });
  }

  createdCallback() {}
  serialize() {}
}


module.exports = Element.initClass();
