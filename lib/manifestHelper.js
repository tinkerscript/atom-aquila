const fs = require('fs');
const path = require('path');

//https://stackoverflow.com/questions/37521893/determine-if-a-path-is-subdirectory-of-another-in-node-js
const isChildOf = (child, parent) =>
  (child !== parent) && parent.split(path.sep).every((t, i) => child.split(path.sep)[i] === t)

const manifests = {};
module.exports = {
  get: () => {
    const { atom } = global;
    const openedProjects = atom.project.getPaths();
    const currentFilePath = atom.workspace.getActivePaneItem().buffer.file.path;
    const openedProject = openedProjects.find( x => isChildOf(currentFilePath, x));

    if (!manifests[openedProject]) {
      const relativeManifestPath = 'node_modules/ecosoft-lexema8/lib/controls.manifest.json';
      const loadManifest = relativePath => {
        const manifestPath = path.resolve(openedProject, relativePath);
        const fileContent = fs.readFileSync(manifestPath, 'utf8');
        return JSON.parse(fileContent);
      };

      this._completions = {};

      try {
        manifests[openedProject] = loadManifest(relativeManifestPath);
      } catch (e) {
        manifests[openedProject] = loadManifest('./controls.manifest.json');
        atom.notifications.addWarning(`Не удалось открыть файл манифеста контролов по пути: ${relativeManifestPath}`, {
          dismissable: true,
          detail: 'Используется манифест контролов ecosoft-lexema8@3.13.0',
          stack: e.stack
        });
      }
    }
    return manifests[openedProject];
  }
};
