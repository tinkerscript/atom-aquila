const path = require('path');

//https://stackoverflow.com/questions/37521893/determine-if-a-path-is-subdirectory-of-another-in-node-js
const isChildOf = (child, parent) =>
  (child !== parent) && parent.split(path.sep).every((t, i) => child.split(path.sep)[i] === t)

const manifests = {};
module.exports = {
  manifests,
  get: () => {
    const { atom } = global;
    const openedProjects = atom.project.getPaths();
    let currentFilePath;
    const model = atom.workspace.getActivePaneItem();
    if (model._filePath) {
      currentFilePath = model._filePath;
    } else if (model.buffer) {
      currentFilePath = model.buffer.file.path;
    } else if (model.selectedPath) {
      currentFilePath = model.selectedPath;
    } else {
      atom.notifications.addError(`Не удалось опрелелить путь редактируемого файла`, {
        dismissable: true
      });
      return null;
    }

    const openedProject = openedProjects.find(x => isChildOf(currentFilePath, x));

    if (!manifests[openedProject]) {
      const relativeManifestPath = 'node_modules/ecosoft-lexema8/lib/controls.manifest.json';

      try {
        const manifestPath = path.resolve(openedProject, relativeManifestPath);
        const package = require(path.resolve(openedProject, 'node_modules/ecosoft-lexema8/package.json'));
        manifests[openedProject] = {
          manifest: require(manifestPath),
          version: `${package.name}@${package.version}`
        };
      } catch (e) {
        const { manifestVersion } = require('../package.json');
        manifests[openedProject] = {
          manifest: require('./controls.manifest.json'),
          version: `${manifestVersion} - по умолчанию.`
        };
        atom.notifications.addWarning(`Не удалось открыть файл манифеста контролов по пути: ${relativeManifestPath}`, {
          dismissable: true,
          detail: `Используется манифест контролов ${manifestVersion}`,
          stack: e.stack
        });
      }
    }
    return manifests[openedProject].manifest;
  }
};
