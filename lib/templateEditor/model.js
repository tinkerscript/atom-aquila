const path = require('path');
const fs = require('fs');
const builder = require('xmlbuilder');
const Signal = require('signals');

module.exports = class Model {
  constructor({ filePath, uri, manifest }) {
    this._filePath = filePath;
    this._uri = uri;
    this._shouldPromptToSave = false;
    this._manifest = manifest;

    this.top = 0;
    this.count = 0;
    this.selected = 0;
    this.template = {};

    this.changed = new Signal();
  }

  getURI() {
    return this._uri;
  }

  getTitle() {
    return path.basename(this._filePath);
  }

  addItem({ type, parentItem }) {
    if (!parentItem.items) {
      parentItem.items = [];
    }

    parentItem.items.push({
      type,
      properties: {},
      items: []
    });

    parentItem.expanded = true;
    this._afterUpdate();
  }

  deleteItem({ targetItem }) {
    const { parent, index } = this._getPosition(targetItem);

    parent.items.splice(index, 1);
    this._afterUpdate();
  }

  isMovePossible ({ targetParent, movedItem }) {
    if (targetParent === movedItem) {
      return false;
    }

    const checkItem = viewItem => {
      return viewItem.items.some(item => {
        if (item === targetParent) {
          return true;
        } else {
          return checkItem(item);
        }
      });
    };

    return !checkItem(movedItem);
  }

  moveItemToEnd ({ targetParent, movedItem }) {
    if (targetParent.expanded == null) {
      return;
    }

    if (!this.isMovePossible({ targetParent, movedItem })) {
      return;
    }

    const { parent, index } = this._getPosition(movedItem);
    parent.items.splice(index, 1);

    targetParent.items.push(movedItem);
    this._afterUpdate();
  }

  moveItem({ targetItem, movedItem }) {
    if (targetItem === this.template || targetItem === movedItem) {
      return;
    }

    const targetItemPosition = this._getPosition(targetItem);
    const movedItemPosition = this._getPosition(movedItem);

    if (!this.isMovePossible({
      targetParent: targetItemPosition.parent,
      movedItem
    })) {
      return;
    }

    movedItemPosition.parent.items.splice(movedItemPosition.index, 1);

    let newIndex = targetItemPosition.index;

    if (targetItemPosition.parent === movedItemPosition.parent) {
      if (movedItemPosition.index > newIndex) {
        newIndex++;
      }
    } else {
      newIndex++;
    }
    targetItemPosition.parent.items.splice(newIndex, 0, movedItem);

    this._afterUpdate();
  }

  _getPosition(target) {
    let result;
    const findParent = viewItem => {
      if (viewItem.items && viewItem.items.length) {
        viewItem.items.some((item, index) => {
          if (item === target) {
            result = {
              parent: viewItem,
              index
            };
            return true;
          } else {
            return findParent(item);
          }
        });
      }
    };

    findParent(this.template);
    return result;
  }

  updateViewItem({ viewItem, propertyName, value }) {
    const controlProperties = this.getDefaultProperties(viewItem.type);
    if (controlProperties[propertyName].value == value) {
      delete viewItem.properties[propertyName];
    } else {
      viewItem.properties[propertyName] = value;
    }
    this._afterUpdate();
  }

  getDefaultProperties(type) {
    return this._manifest[type].properties;
  }

  loadTemplate() {
    const { atom: { project: { rootDirectories: [folder = {}] = [] } } } = global;
    const folderPath = folder.path;

    if (!folderPath) {
      new Error(`folder not found: ${folderPath}`);
    }

    const parseTemplate = require(path.resolve(folderPath, 'node_modules/ecosoft-lexema8/build/loaders/template/parse'));
    const fullFilePath = path.resolve(folderPath, this._filePath);

    let fileContent;
    if (fs.existsSync(fullFilePath)) {
      fileContent = fs.readFileSync(fullFilePath, 'utf-8');
    } else {
      new Error(`file not found: ${fullFilePath}`)
    }

    const options = {
      rootTag: 'Form',
      layoutTag: 'Layout',
      manifest: this._manifest
    };

    return parseTemplate(fileContent, options).then(template => {

      const iterateTemplate = (template) => {
        if (template.items && template.items.length) {
          template.expanded = false;
          template.items.forEach(iterateTemplate);
        }
      };
      iterateTemplate(template);

      this.template = template;
    });
  }

  shouldPromptToSave() {
    return this._shouldPromptToSave;
  }

  createViewModel() {
    const { template = {}, top, count, selected } = this;
    const min = top,
      max = top + count;
    const plain = [];
    let counter = 0;

    const iterate = (item, parent, level = 0) => {
      const { items, expanded } = item;
      if (counter >= min && counter < max) {
        const isSelected = selected == counter;
        plain.push({
          item,
          parent,
          level,
          id: counter,
          isSelected
        });
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

  save() {
    const pureTree = this.template;
    const xml = builder.begin();

    const traverse = (item, xml) => {
      const { type, properties, items } = item;
      xml = xml.ele(type, properties);
      items.forEach(child => {
        traverse(child, xml);
      });
    };

    traverse(pureTree, xml);
    const content = xml.end({ pretty: true });
    fs.writeFileSync(this._filePath, content, 'utf8');
    this._shouldPromptToSave = false;
  }

  _afterUpdate() {
    this.changed.dispatch();
    this._shouldPromptToSave = true;
  }
}
