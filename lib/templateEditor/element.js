/* global atom */

const { registerOrUpdateElement } = require('atom-utils')
const path = require('path');
const fs = require('fs');
const scrollbar = require('perfect-scrollbar');
const elementResizeDetector = require('element-resize-detector')({
  strategy: 'scroll'
});

const LINE_HEIGHT = 22;

const getVisibleItemsCount = () => {
  const editorHeight = atom.workspace.paneContainer.element.getElementsByClassName('item-views')[0].offsetHeight;
  console.log(editorHeight)
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


class Element {
  static initClass() {
    return registerOrUpdateElement('atom-aquila', { class: this });
  }

  createdCallback() {

  }

  _gridInitialize() {
    const { document } = global;
    const grid = document.createElement('div');
    grid.classList.add('atom-aquila-grid');
    this._grid = grid;
    this.appendChild(grid);
  }

  _renderGrid(viewItem, editedProperty) {
    const { document } = global;
    this._grid.innerHTML = '';

    const table = document.createElement('table');
    const controlProperties = this._manifest[viewItem.type].properties;
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
        tr.classList.add('atom-aquila-bolder');
      }

      if (key == editedProperty) {
        const input = document.createElement('input');
        tdRight.appendChild(input);
        input.classList.add('native-key-bindings');
        input.setAttribute('type', 'text');
        input.focus();
        if (property != null) {
          input.setAttribute('value', property);
          const length = property.toString().length;
          input.setSelectionRange(length, length);
        }

        input.addEventListener('change', () => {
          const { value } = input;
          if (property != value) {
            if (controlProperties[key].value == value) {
              delete viewItem.properties[key];
            } else {
              viewItem.properties[key] = input.value;
            }
          }
        });
      } else {
        tdRight.textContent = property;
      }

      tdRight.addEventListener('click', () => {
        if (editedProperty != key) {
          this._renderGrid(viewItem, key);
        }
      });
    });
  }

  _treeInitialize() {
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
  }

  _renderTree() {
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
        this._renderGrid(item)
        this._renderTree();
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

  getModel() {
    return this._model;
  }

  setModel(model) {
    this._model = model;

    const { atom: { project: { rootDirectories: [folder = {}] = [] } } } = global;
    const folderPath = folder.path;

    if (!folderPath) {
      new Error(`folder not found: ${folderPath}`);
    }

    const manifestPath = path.resolve(folderPath, 'node_modules/ecosoft-lexema8/lib/controls.manifest.json');
    const parseTemplate = require(path.resolve(folderPath, 'node_modules/ecosoft-lexema8/build/loaders/template/parse'));
    const fullFilePath = path.resolve(folderPath, this.getModel().filePath);

    let manifest, fileContent;
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } else {
      new Error(`file not found: ${manifestPath}`)
    }
    if (fs.existsSync(fullFilePath)) {
      fileContent = fs.readFileSync(fullFilePath, 'utf-8');
    } else {
      new Error(`file not found: ${manifestPath}`)
    }

    const options = {
      rootTag: 'Form',
      layoutTag: 'Layout',
      manifest
    };
    this._manifest = manifest;

    return parseTemplate(fileContent, options).then(template => {
      this.classList.add('atom-aquila');

      const iterateTemplate = (template) => {
        if (template.items && template.items.length) {
          template.expanded = false;
          template.items.forEach(iterateTemplate);
        }
      };
      iterateTemplate(template);

      this._model.template = template;
      this._model.count = getVisibleItemsCount();
      elementResizeDetector.listenTo(this, () => {
        this._renderTree();
      });

      this._treeInitialize();
      this._gridInitialize();
    });
  }

  serialize() {}

  destroy() {}

}


module.exports = Element.initClass();
