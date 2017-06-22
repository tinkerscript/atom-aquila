const { CompositeDisposable } = require('atom');

module.exports = {
  activate() {
    const atom = global.atom;
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-aquila:model': () => {
        console.log('hello, atom');
      }
    }));
  },
  deactivate() {
    this.subscriptions.dispose();
  }
};
