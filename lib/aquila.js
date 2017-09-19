const { CompositeDisposable } = require('atom');
const { name, version } = require('../package.json');
const xmlAutoCompleteProvider = require('./xmlAutoComplete/provider');
const Model = require('./templateEditor/model');
const View = require('./templateEditor/element');
const manifestHelper = require('./manifestHelper');

module.exports = {
  activate() {
    const { atom } = global;

    const manifest = manifestHelper.get();

    const controls = Object.keys(manifest).map(type => {
      const { hidden, placing, categories } = manifest[type];
      return {
        hidden,
        placing,
        categories,
        label: type,
        selector: `.aquila-control-${type}`,
        command: `aquila:add-node-${type}`,
        handler: ({ target: { dataset: { aquilaId } } }) => {
          const model = atom.workspace.getActivePaneItem();
          const parentItem = atom.views.getView(model).viewModel
            .find( x => x.id == aquilaId).item;
          model.addItem({ type, parentItem });
        }
      }
    });

    atom.views.addViewProvider(Model, model => {
      const view = new View();
      view.setModel(model);
      return view;
    });
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace', Object.assign({
      'aquila:edit': ({ target }) => {
        if (target.tagName === 'LI') {
          target = target.children[0];
        }
        const { dataset: { path = '' } } = target;
        const uri = `aquila://${path}`;
        atom.workspace.open(uri);
      },
      'aquila:status': () => {
        const message = `${name}@${version}: loaded.`;
        atom.notifications.addInfo(message, { dismissable: true });
      },
      'aquila:delete-node': ({ target: { dataset: { aquilaId } } }) => {
        const model = atom.workspace.getActivePaneItem();
        const { item, parent } = atom.views.getView(model).viewModel
          .find( x => x.id == aquilaId);

        model.deleteItem({ targetItem: item, parentItem: parent });
      }
    }, controls.reduce((result, { command, handler }) => {
      result[command] = handler;
      return result;
    }, {}))));

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
          atom.workspace.getActivePaneContainer()
            .paneContainer
            .element
            .querySelector('.tab.active')
            .classList
            .remove('modified');
        }
      }
    });

    controls.forEach(({ selector, categories = [] }) => {
      const result = {};
      result[selector] = [{
        label: 'Добавить',
        submenu: controls.filter(({ hidden, placing }) => {
          return !hidden && categories.some(category => placing[category]);
        }).map(({ label, command }) => {
          return { label, command };
        })
      }, {
        label: 'Удалить',
        command: 'aquila:delete-node'
      }];

      atom.contextMenu.add(result);
    });
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  getProvider() {
    return xmlAutoCompleteProvider;
  }
};
