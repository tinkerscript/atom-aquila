const { CompositeDisposable } = require('atom');
const { name, version } = require('../package.json');
const xmlAutoCompleteProvider = require('./xmlAutoComplete/provider');
const Model = require('./templateEditor/model');
const View = require('./templateEditor/element');

module.exports = {
  activate() {
    const { atom } = global;

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

      const model = new Model({ filePath, uri });
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

    atom.commands.onDidDispatch( e => {
      if(e.type == 'core:save'){
        const model = atom.workspace.getActivePaneItem();
        if(model && model instanceof Model){
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

    xmlAutoCompleteProvider.loadCompletions();
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  getProvider() {
    return xmlAutoCompleteProvider;
  }
};
