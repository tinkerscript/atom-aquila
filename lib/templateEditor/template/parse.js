const { parseString } = require('xml2js');

module.exports = (text, { manifest = {} }) => {
  const typeHandlers = {
    bool: (x = '', type, errorCallback) => {
      x = x.toLowerCase();

      if (x === 'true') {
        return true;
      } else if (x === 'false') {
        return false;
      }
      errorCallback();
    },
    int: (x, type, errorCallback) => {
      try {
        return parseInt(x, 10);
      } catch (err) {
        errorCallback();
      }
    },
    float: (x, type, errorCallback) => {
      try {
        return parseFloat(x, 10)
      } catch (err) {
        errorCallback();
      }
    },
    array: (value, arr, errorCallback) => {
      if (arr.indexOf(value) > -1) {
        return value;
      } else {
        errorCallback();
      }
    },
  };

  const reviseItem = item => {
    for (let key in item) {
      if (key !== 'items' && Array.isArray(item[key])) {
        delete item[key];
      }

      if (key === '#name') {
        let value = item[key];
        item.type = value;
        delete item[key];
      }
    }

    item.properties = item.properties || {};
    const control = manifest[item.type];

    if (!control) {
      throw new Error(`Недопустимый тэг ${item.type}.`);
    }

    return item;
  };

  const processTemplate = template => {
    const errors = [];

    const iterate = (node, parent) => {
      node = reviseItem(node);

      const control = manifest[node.type];
      const { properties = {}, placing = {} } = control;
      const { type: parentType = '', items: parentItems = [] } = parent || {};

      const places = Object.keys(placing).filter(key => {
        const control = manifest[parentType];
        const { categories = [] } = control || {};

        return categories.indexOf(key) > -1 || (key === '' && parent == null);
      }).map(key => placing[key]);

      if (!places.length) {
        errors.push(`Тэг ${node.type} не может быть помещён в тэг ${parentType}`);
        return;
      }

      places.forEach(place => {
        if (!place) {
          errors.push(`Тэг ${node.type} не может быть помещён в тэг ${parentType}`);
          return;
        }

        switch (place) {
          case 'multiple':
            //всё норм. лепи что хочешь
            break;
          case 'unique':
            {
              const sameTags = parentItems.filter(item => {
                const { type: itemType } = item;
                return node !== item && itemType == node.type;
              });

              if (sameTags.length) {
                errors.push(`Тэг ${parentType} не может содержать несколько тэгов ${node.type}.`);
              }
            }

            break;
          default:
            {
              //объект (или повреждённый манифест)
              //раз объект - значит, исключающее размещение (другого пока нет)
              const { tags = [] } = place;
              const sameCategories = parentItems.filter(item => {
                if (item == node) {
                  return false;
                }

                item = reviseItem(item);

                const { type: itemType = '' } = item;
                const control = manifest[itemType];
                const { categories: itemCategories = [] } = control;

                return tags.filter(tag => {
                  return itemCategories.indexOf(tag) > -1;
                }).length;
              }).map(({ type }) => type);

              if (sameCategories.length) {
                const categories = sameCategories.join(', ');
                errors.push(`Тэг ${node.type} не может быть размещён вместе с тэгами ` +
                  `${categories} в тэге ${parentType}.`);
              }
            }
        }
      });

      for (let prop in node.properties) {
        const desc = properties[prop];

        if (!desc) {
          errors.push(`Тэг ${node.type} имеет недопустимое свойство "${prop}".`);
          continue;
        }


        const type = desc.type;
        const handler = Array.isArray(type) ? typeHandlers['array'] : typeHandlers[type];
        if (!handler) {
          continue;
        }

        const errorCallback = () => {
          errors.push(`Тэг ${node.type} имеет недопустимое значение свойства "${prop}"` +
            ` ("${node.properties[prop]}").`);
        }

        let value = handler(node.properties[prop], type, errorCallback);
        node.properties[prop] = value;
      }

      node.items = node.items || [];
      node.items.forEach(item => {
        iterate(item, node);
      });
    };

    iterate(template);

    if (errors.length) {
      throw new Error(errors.join('\n'));
    }

    return template;
  };

  return new Promise((resolve, reject) => {
    parseString(text, {
      explicitRoot: true,
      explicitChildren: true,
      preserveChildrenOrder: true,
      attrkey: 'properties',
      childkey: 'items',
      charkey: 'content'
    }, (err, { Form } = {}) => {
      let template;

      if (!err) {
        try {
          template = processTemplate(Form, manifest);
        } catch (e) {
          err = e;
        }
      }

      if (err) {
        reject(err);
      } else {
        resolve(template);
      }
    });
  });
};
