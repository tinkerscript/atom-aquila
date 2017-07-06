module.exports = class Model {
  constructor({ filePath }) {
    this.filePath = filePath;
    this.top = 0;
    this.count = 0;
    this.selected = 0;
    this.template = {};

    
  }

  getTitle() {
    return 'title';
  }
}
