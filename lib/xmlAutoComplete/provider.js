const trailingWhitespace = /\s$/; //;
const attributePattern = /\s+([a-zA-Z][-a-zA-Z]*)\s*=\s*$/;
const tagPattern = /<([.\-_a-zA-Z0-9]*)(?:\s|$)/;
const manifestHelper = require('../manifestHelper')

module.exports = {
  selector: '.text.xml', // enable for XML
  disableForSelector: '.text.xml .comment', // disable for comments

  // Take priority over other plugins, not necessary
  // inclusionPriority: 1,
  // excludeLowerPriority: true,

  get completions() {
    return this._completions || {};
  },

  set completions(value) {
    this._completions = value;
  },

  getSuggestions(request) {
    this.completions = manifestHelper.get();
    if (this.isAttributeValue(request)) {
      return this.getAttributeValueCompletion(request);
    } else if (this.isAttributeNameStartWithNoPrefix(request)) {
      return this.getAllAttributeNameCompletions(request);
    } else if (this.isAttributeNameStartWithPrefix(request)) {
      return this.getAttributeNameCompletions(request);
    } else if (this.isTagNameStartWithNoPrefix(request)) {
      return this.getAllTagNameCompletions(request);
    } else if (this.isTagNameStartWithPrefix(request)) {
      return this.getTagNameCompletions(request);
    } else {
      return [];
    }
  },

  // check if the cursor is on a tag name (prefix is empty)
  isTagNameStartWithNoPrefix: ({ prefix, scopeDescriptor, editor, bufferPosition } = {}) => {
    const scopes = scopeDescriptor.getScopesArray();
    const char = editor.getTextInBufferRange([
      [
        bufferPosition.row,
        bufferPosition.column - prefix.length - 1
      ],
      [
        bufferPosition.row,
        bufferPosition.column - prefix.length
      ]
    ]);

    return char === '<' && scopes.length === 1 && scopes[0] === 'text.xml';
  },

  // check if the cursor is on a incomplete tag name
  isTagNameStartWithPrefix: ({ prefix, scopeDescriptor } = {}) => {
    const scopes = scopeDescriptor.getScopesArray();

    if (!prefix) {
      return false;
    }

    if (trailingWhitespace.test(prefix)) {
      return false;
    }

    return scopes.indexOf('meta.tag.xml') !== -1;
  },

  // check if the cursor is on an attribute name (prefix is empty)
  isAttributeNameStartWithNoPrefix: ({ prefix, scopeDescriptor } = {}) => {
    const scopes = scopeDescriptor.getScopesArray();

    if (!trailingWhitespace.test(prefix)) {
      return false;
    }

    return scopes.indexOf('meta.tag.xml') !== -1;
  },

  // check if the cursor is on an incomplete attribute name
  isAttributeNameStartWithPrefix: ({ prefix, scopeDescriptor, editor, bufferPosition } = {}) => {
    const scopes = scopeDescriptor.getScopesArray();
    const char = editor.getTextInBufferRange([
      [
        bufferPosition.row, bufferPosition.column - prefix.length - 1
      ],
      [
        bufferPosition.row, bufferPosition.column - prefix.length
      ]
    ]);

    return (scopes.indexOf('meta.tag.xml') !== -1 ||
      scopes.indexOf('meta.tag.no-content.xml') !== -1) && char == ' ';
  },

  // check if the cursor is on an incomplete attribute value
  isAttributeValue: ({ prefix, scopeDescriptor } = {}) => {
    const scopes = scopeDescriptor.getScopesArray();
    const lastPrefixCharacter = prefix[prefix.length - 1];

    if (lastPrefixCharacter === '"' || lastPrefixCharacter === "'") {
      return false;
    }

    return (scopes.indexOf('string.quoted.double.xml') !== -1 ||
        scopes.indexOf('string.quoted.single.xml') !== -1) &&
      scopes.indexOf('meta.tag.xml') !== -1;
  },

  // get the tag name completion when prefix is empty
  getAllTagNameCompletions: function() {
    return Object.keys(this.completions).map(tag => {
      return {
        text: tag,
        type: 'tag',
        description: tag,
        descriptionMoreURL: `https://www.google.ru/search?q=${tag}`,
        replacementPrefix: ''
      };
    });
  },

  // get the tag name completion
  getTagNameCompletions: function({ prefix } = {}) {
    return Object.keys(this.completions).reduce((result, tag) => {
      if (tag.startsWith(prefix)) {
        result.push({
          text: tag,
          type: 'tag',
          description: tag,
          descriptionMoreURL: `https://www.google.ru/search?q=${tag}`,
          replacementPrefix: prefix
        });
      }

      return result;
    }, []);
  },

  // get the atrribute name completion when prefix is empty
  getAllAttributeNameCompletions: function({ editor, bufferPosition } = {}) {
    const tag = this.getPreviousTag(editor, bufferPosition);
    const { properties = {} } = this.completions[tag] || {};

    return Object.keys(properties).map(key => {
      const { value } = properties[key] || {};

      return {
        text: key,
        type: 'attribute',
        description: value ? `Default value: ${value}` : undefined,
        replacementPrefix: ''
      };
    });
  },

  // get the atrribute name completion
  getAttributeNameCompletions: function({ editor, bufferPosition, prefix } = {}) {
    const tag = this.getPreviousTag(editor, bufferPosition);
    const { properties = {} } = this.completions[tag] || {};

    return Object.keys(properties).reduce((result, key) => {
      const { value } = properties[key] || {};

      if (key.startsWith(prefix)) {
        result.push({
          text: key,
          type: 'attribute',
          description: value ? `Default value: ${value}` : undefined,
          replacementPrefix: prefix
        });
      }

      return result;
    }, []);
  },

  // get the atrribute value completion
  getAttributeValueCompletion: function({ editor, bufferPosition, prefix } = {}) {
    const tag = this.getPreviousTag(editor, bufferPosition);
    const attribute = this.getPreviousAttribute(editor, bufferPosition);

    const {
      properties: {
        [attribute]: { type } = {}
      } = {}
    } = this.completions[tag] || {};

    if (type == 'bool') {
      return [{
        text: 'true',
        type: 'value',
        replacementPrefix: prefix
      }, {
        text: 'false',
        type: 'value',
        replacementPrefix: prefix
      }];
    }
  },

  // get the current tag
  getPreviousTag: (editor, { row } = {}) => {
    while (row >= 0) {
      const ref = tagPattern.exec(editor.lineTextForBufferRow(row));
      const tag = ref != null ? ref[1] : void 0;

      if (tag) {
        return tag;
      }

      row--;
    }
  },

  // get the current attribute
  getPreviousAttribute: (editor, bufferPosition) => {
    var ref, ref1;

    let line = editor.getTextInRange([
      [bufferPosition.row, 0], bufferPosition
    ]).trim();
    let quoteIndex = line.length - 1;

    while (line[quoteIndex] && !((ref = line[quoteIndex]) === '"' || ref === "'")) {
      quoteIndex--;
    }

    line = line.substring(0, quoteIndex);

    return (ref1 = attributePattern.exec(line)) != null ? ref1[1] : void 0;
  },
};
