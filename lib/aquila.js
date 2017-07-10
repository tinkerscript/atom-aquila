const { CompositeDisposable } = require('atom');
const { name, version } = require('../package.json');
const xmlAutoCompleteProvider = require('./xmlAutoComplete/provider');
const Model = require('./templateEditor/model');
const View = require('./templateEditor/element');
const path = require('path');
const fs = require('fs');

module.exports = {
  activate() {
    const { atom } = global;

    const { atom: { project: { rootDirectories: [folder = {}] = [] } } } = global;
    const folderPath = folder.path;
    const manifestPath = path.resolve(folderPath, 'node_modules/ecosoft-lexema8/lib/controls.manifest.json');
    let manifest;
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } else {
      new Error(`file not found: ${manifestPath}`)
    }

    const controls = Object.keys(manifest).map(key => {
      return {
        label: key,
        selector: `.aquila-control-${key}`,
        command: `aquila:add-node-${key}`,
        handler: ({ target: { dataset: { aquilaId } } }) => {
          const model = atom.workspace.getActivePaneItem();
          model.addNode({ name: key, parentId: aquilaId });
        }
      }
    });

    atom.views.addViewProvider(Model, model => {
      const view = new View();
      view.setModel(model);
      return view;
    });

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'aquila:edit': ({ target: { dataset: { path = '' } } }) => {
        const uri = `aquila://${path}`;
        atom.workspace.open(uri);
      },
      'aquila:status': () => {
        const message = `${name}@${version}: loaded.`;
        atom.notifications.addInfo(message, { dismissable: true });
      }
    }));

    atom.workspace.addOpener((uri = '') => {
      let [protocol, filePath = ''] = uri.split('://');

      if (protocol !== 'aquila') {
        return;
      }
      try {
        filePath = decodeURI(filePath);
      } catch (e) {
        console.error(e);
        return;
      }

      const model = new Model({ filePath, uri, manifest });
      model.changed.add(() => {
        atom.workspace.getActivePaneContainer()
          .paneContainer
          .element
          .querySelector('.tab.active')
          .classList
          .add('modified');
      });
      return model;
    });

    atom.commands.onDidDispatch(e => {
      if (e.type == 'core:save') {
        const model = atom.workspace.getActivePaneItem();
        if (model && model instanceof Model) {
          model.save();
          atom.workspace.getActivePaneContainer()
            .paneContainer
            .element
            .querySelector('.tab.active')
            .classList
            .remove('modified');
        }
      }
    });

    controls.forEach(({ selector }) => {
      const result = {};
      result[selector] = [{
        label: 'Добавить элемент',
        submenu: controls.map(({ label, command }) => {
          return { label, command };
        })
      }];

      atom.contextMenu.add(result);
    });

    xmlAutoCompleteProvider.loadCompletions();
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  getProvider() {
    return xmlAutoCompleteProvider;
  }
};
