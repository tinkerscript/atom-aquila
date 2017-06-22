const { CompositeDisposable } = require('atom');
const TemplateEditorView = require('./views/templateEditor')

module.exports = {
  activate() {
    const atom = global.atom;
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'aquila:model': ({ target: { dataset: { path = '' } } }) => {
        const uri = `aquila://${path}`;
        atom.workspace.open(uri);
      },
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
