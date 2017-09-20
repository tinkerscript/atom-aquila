const path = require('path');
const fs = require('fs');
const builder = require('xmlbuilder');
const Signal = require('signals');

const { atom } = global;

module.exports = class Model {
  constructor({ filePath, uri, manifest }) {
    this._filePath = filePath;
    this._uri = uri;
    this._shouldPromptToSave = false;
    this.manifest = manifest;

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

  deleteItem({ targetItem, parentItem }) {
    const index = this._getIndex({ targetItem, parentItem });

    parentItem.items.splice(index, 1);
    this._afterUpdate();
  }

  _isMovePossible({ targetParent, movedItem }) {
    if (targetParent === movedItem) {
      return false;
    }

    const checkedByManifestRules = this.manifest[targetParent.type].categories.some(subject => {
      const placing = this.manifest[movedItem.type].placing[subject];
      if ((placing === 'unique' && targetParent.items.length === 0) || placing === 'multiple')  {
        return true;
      }
      else if (typeof placing === 'object') {
        if (placing.type === 'exclude') {
          const containsInExclude = placing.tags.some(excludedTag => {
            return targetParent.items.some(({ type }) => {
              return this.manifest[type].categories.some(x => x === excludedTag)});
          });
          return !containsInExclude;
        }
      } else {
        return false;
      }
    });

    if (!checkedByManifestRules) {
      return false;
    }
    this.manifest[movedItem.type]

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

  moveToBottom({ targetParent, movedItem, movedParent }) {
    if (targetParent.expanded == null) {
      return;
    }

    if (!this._isMovePossible({ targetParent, movedItem })) {
      return;
    }

    const index = this._getIndex({
      targetItem: movedItem,
      parentItem: movedParent
    });
    movedParent.items.splice(index, 1);

    targetParent.items.push(movedItem);
    this._afterUpdate();
  }

  moveToTop({ targetParent, movedItem, movedParent }) {
    if (targetParent.expanded == null) {
      return;
    }

    if (!this._isMovePossible({ targetParent, movedItem })) {
      return;
    }

    const index = this._getIndex({
      targetItem: movedItem,
      parentItem: movedParent
    });
    movedParent.items.splice(index, 1);

    targetParent.items.splice(0, 0, movedItem);
    this._afterUpdate();
  }

  moveAfterItem({ targetItem, movedItem, targetParent, movedParent }) {
    if (targetItem === this.template || targetItem === movedItem) {
      return;
    }

    if (!this._isMovePossible({
        targetParent,
        movedItem
      })) {
      return;
    }

    const targetIndex = this._getIndex({ targetItem, parentItem: targetParent });
    const movedIndex = this._getIndex({
      targetItem: movedItem,
      parentItem: movedParent
    });

    movedParent.items.splice(movedIndex, 1);

    let newIndex = targetIndex;

    if (targetParent === movedParent) {
      if (movedIndex > newIndex) {
        newIndex++;
      }
    } else {
      newIndex++;
    }
    targetParent.items.splice(newIndex, 0, movedItem);

    this._afterUpdate();
  }

  _getIndex({ targetItem, parentItem }) {
    return parentItem.items.indexOf(targetItem);
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
    return this.manifest[type].properties;
  }

  loadTemplate() {
    const { atom: { project: { rootDirectories: [folder = {}] = [] } } } = global;
    const folderPath = folder.path;

    if (!folderPath) {
      new Error(`folder not found: ${folderPath}`);
    }
    let parseTemplate;
    try {
      parseTemplate = require(path.resolve(folderPath, 'node_modules/ecosoft-lexema8/build/loaders/template/parse'));
    } catch ({ stack }) {
      atom.notifications.addError('Не удалось загрузить парсер шаблонов.', {
        dismissable: true,
        detail: stack
      });
      this.template = { type: 'Form', properties: {}, items: [] };
      return Promise.resolve(this.template);
    }

    const fullFilePath = path.resolve(folderPath, this._filePath);

    let fileContent;
    if (fs.existsSync(fullFilePath) && !fs.lstatSync(fullFilePath).isDirectory()) {
      fileContent = fs.readFileSync(fullFilePath, 'utf-8');
    } else {
      atom.notifications.addError(`Не удалось открыть файл шаблона по пути ${fullFilePath}`, {
        dismissable: true
      });
      this.template = { type: 'Form', properties: {}, items: [] };
      return Promise.resolve(this.template);
    }

    const options = {
      rootTag: 'Form',
      layoutTag: 'Layout',
      manifest: this.manifest
    };

    if (fileContent) {
      const result = parseTemplate(fileContent, options);
      result.then(template => {
        const iterateTemplate = (template) => {
          if (template.items && template.items.length) {
            template.expanded = false;
            template.items.forEach(iterateTemplate);
          }
        };
        iterateTemplate(template);
        this.template = template;
        return template;
      }).catch(err => {
        atom.notifications.addError(err.message.split('\n').join('<br/>'), {
          dismissable: true
        });
       console.error(err);
      });

      return result;
    } else {
      this.template = { type: 'Form', properties: {}, items: [] };
      return Promise.resolve(this.template);
    }
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
    try {
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
    } catch ({ stack }) {
      atom.notifications.addError(`Не удалось сохранить файл ${this._filePath}`, {
        dismissable: true,
        detail: stack
      });
    }
  }

  _afterUpdate() {
    this.changed.dispatch();
    this._shouldPromptToSave = true;
  }
}
