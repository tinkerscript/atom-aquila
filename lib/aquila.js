const { CompositeDisposable } = require('atom');
const { name, version } = require('../package.json');
const TemplateEditorView = require('./views/templateEditor')

module.exports = {
  activate() {
    const { atom } = global;
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

      return new TemplateEditorView({ filePath });
    });
  },

  deactivate() {
    this.subscriptions.dispose();
  }
};
