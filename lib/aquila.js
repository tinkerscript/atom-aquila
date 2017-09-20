const { CompositeDisposable } = require('atom');
const { name, version } = require('../package.json');
const xmlAutoCompleteProvider = require('./xmlAutoComplete/provider');
const Model = require('./templateEditor/model');
const View = require('./templateEditor/element');
const manifestHelper = require('./manifestHelper');
const createControlsWindow = require('./templateEditor/createControlsWindow');

module.exports = {
  activate() {
    const { atom } = global;

    atom.views.addViewProvider(Model, model => {
      const view = new View();
      view.setModel(model);
      return view;
    });

    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add('atom-workspace',{
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
      },
      'aquila:add-node': ({ target: { dataset: { aquilaId } } }) => {
        const model = atom.workspace.getActivePaneItem();
        const { manifest } = model;
        const view = atom.views.getView(model);
        const parentItem = view.viewModel
          .find( x => x.id == aquilaId).item;

        const window = createControlsWindow({
          manifest,
          parentItem,
          selected: ({ type }) => {
            model.addItem({ type, parentItem });
          }
         });
         window.show();
      },
    }))

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

      const manifest = manifestHelper.get();
      if (manifest == null) {
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

    atom.contextMenu.add({
      '.aquila-control': [{
          label: 'Добавить',
          command: 'aquila:add-node'
        },{
          label: 'Удалить',
          command: 'aquila:delete-node'
        }]
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
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  getProvider() {
    return xmlAutoCompleteProvider;
  }
};
