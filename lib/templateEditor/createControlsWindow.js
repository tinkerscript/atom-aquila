/* global atom */

const renderWindow = (availableControls, selected) => {
  const div = global.document.createElement('div');
  const button = global.document.createElement('button');
  button.innerHTML = 'Закрыть';
  button.classList.add('atom-aquila-controls-window-close');
  div.appendChild(button);
  button.addEventListener('click', () => {
    panel.hide();
  });
  div.classList.add('atom-aquila-controls-window-list')
  availableControls.forEach(controlType => {
    const child = global.document.createElement('div');
    child.innerHTML = controlType;
    child.classList.add('atom-aquila-controls-window-item');
    child.addEventListener('click', () => {
      selected({ type: child.innerHTML })
      panel.destroy();
    });
    div.appendChild(child);
  });

  const panel = atom.workspace.addModalPanel({ item: div, visible: false });
  return panel;
}

module.exports = ({ manifest, parentItem: { type }, selected }) => {
  const controls = Object.keys(manifest).map(type => {
    return Object.assign(manifest[type], { type });
  });

  const { categories } = manifest[type]
  const availableControls = controls.filter(({ hidden, placing }) => {
    return !hidden && categories.some(category => placing[category]);
  }).map(x => x.type);

  return renderWindow(availableControls, selected);
};
