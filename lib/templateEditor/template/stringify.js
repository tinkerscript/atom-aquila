module.exports = (template, { manifest = {} } = {}, stringifyRequest) => {
  const serializeProps = ({ properties = {}, definedProps = {} } = {}) => {
    return Object.keys(properties).map(key => {
      const { type } = definedProps[key] || {};
      let value = properties[key];

      if (type === 'import') {
        value = `require(${stringifyRequest(value)})`;
      } else if (type === 'import-default') {
        value = `require(${stringifyRequest(value)}).default`;
      } else {
        value = JSON.stringify(value);
      }

      return `"${key}": ${value}`;
    });
  };

  const serializeItem = ({ type = '', items = [], properties = {} }) => {
    const { properties: definedProps, modulePath } = manifest[type];
    const Ctor = `Ctor: require("${modulePath}").${type},`;
    const props = serializeProps({ properties, definedProps }).join(',');
    items = items.map(serializeItem).join(',');

    return `{type: "${type}",${Ctor}properties: {${props}},items: [${items}]}`;
  };

  return serializeItem(template);
};
