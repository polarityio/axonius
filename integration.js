'use strict';

const request = require('postman-request');
const async = require('async');

const entityTemplateReplacementRegex = /{{entity}}/gi;
const testAssets = require('./test-assets');
const USE_TEST_DATA = false;

let Logger;
let requestWithDefaults;

const MAX_PARALLEL_LOOKUPS = 10;

const DEVICE_FIELDS_TO_RETURN = [
  'adapters',
  'specific_data.data.name',
  'specific_data.data.hostname',
  'specific_data.data.last_seen',
  'specific_data.data.first_fetch_time',
  'specific_data.data.network_interfaces.ips_preferred',
  'specific_data.data.network_interfaces.mac_preferred',
  'specific_data.data.os.type_distribution_preferred',
  'specific_data.data.os.type_distribution',
  'specific_data.data.last_used_users',
  'specific_data.data.last_used_users_mail_association',
  'specific_data.data.open_ports',
  'specific_data.data.software_cves',
  'specific_data.data.agent_versions',
  'specific_data.data.installed_software',
  'specific_data.data.security_patches',
  'labels'
];

const USER_DEVICE_FIELDS_TO_RETURN = [
  'specific_data.data.display_name',
  'specific_data.data.last_seen',
  'specific_data.data.first_fetch_time',
  'specific_data.data.is_local',
  'specific_data.data.is_locked',
  'last_logon',
  'logon_count',
  'specific_data.data.employee_id',
  'user_status',
  'groups',
  'specific_data.data.associated_devices'
];

/**
 *
 * @param entities
 * @param options
 * @param cb
 */
function startup(logger) {
  let defaults = {
    json: true
  };
  Logger = logger;

  requestWithDefaults = request.defaults(defaults);
}

function escapeEntityValue(entityValue) {
  return entityValue
    .toLowerCase()
    .replace(/(\r\n|\n|\r)/gm, '')
    .replace(/"/g, '"');
}

function getIpQuery(entity, options) {
  const entityValue = entity.value.trim();
  const query = options.ipQuery.replace(entityTemplateReplacementRegex, escapeEntityValue(entityValue));

  return {
    include_metadata: true,
    use_cache_entry: true,
    include_details: false,
    fields: DEVICE_FIELDS_TO_RETURN,
    query,
    page: {
      offset: 0,
      limit: options.searchLimit
    }
  };
}

function getHostnameQuery(entity, options) {
  const entityValue = entity.value.trim();
  const query = options.hostQuery.replace(entityTemplateReplacementRegex, escapeEntityValue(entityValue));

  return {
    include_metadata: true,
    use_cache_entry: true,
    include_details: false,
    fields: DEVICE_FIELDS_TO_RETURN,
    query,
    page: {
      offset: 0,
      limit: options.searchLimit
    }
  };
}

function getUserQuery(entity, options) {
  const entityValue = entity.value.trim();
  const query = options.userQuery.replace(entityTemplateReplacementRegex, escapeEntityValue(entityValue));

  return {
    include_metadata: true,
    fields: USER_DEVICE_FIELDS_TO_RETURN,
    query,
    page: {
      offset: 0,
      limit: options.searchLimit
    }
  };
}

/**
 * Ember templates do not support displaying keys with dots in them so we have to convert
 * all dots in keys to dashes.
 * For example, the key `specific_data.data.hostname` becomes `specific_data-data-hostname`
 *
 * @param object
 * @returns {{}|*}
 */
function dotsToDashes(object) {
  if (Array.isArray(object)) {
    return object.map(dotsToDashes);
  } else if (object !== null && typeof object === 'object') {
    return Object.entries(object).reduce((acc, [key, value]) => {
      const newKey = key.replace(/\./g, '-');
      acc[newKey] = dotsToDashes(value);
      return acc;
    }, {});
  }
  return object;
}

/**
 * Recursively iterates over an object and removes any keys where the value is null.
 * Also removes null values from within arrays. If the array becomes empty due to
 * only containing null values, the array is removed. If an object becomes empty
 * due to all values being removed (or if the object was empty to begin with), the
 * object should be removed.
 *
 * @param object
 * @returns {*} The cleaned object with null values removed.
 */
function removeNullAndEmptyValues(object) {
  if (Array.isArray(object)) {
    const filteredArray = object
      .map(removeNullAndEmptyValues)
      .filter((item) => item !== null && item !== undefined && item !== '');
    return filteredArray.length > 0 ? filteredArray : null;
  } else if (object !== null && typeof object === 'object') {
    const cleanedObject = Object.entries(object).reduce((acc, [key, value]) => {
      const cleanedValue = removeNullAndEmptyValues(value);
      if (cleanedValue !== null && cleanedValue !== undefined && cleanedValue !== '') {
        acc[key] = cleanedValue;
      }
      return acc;
    }, {});
    return Object.keys(cleanedObject).length > 0 ? cleanedObject : null;
  }
  return object !== '' ? object : null;
}

function sortPorts(assets) {
  if (Array.isArray(assets)) {
    return assets.map((asset) => {
      if (Array.isArray(asset['specific_data-data-open_ports'])) {
        asset['specific_data-data-open_ports'] = asset['specific_data-data-open_ports'].sort(
          (a, b) => a.port_id - b.port_id
        );
      }
      return asset;
    });
  }

  return assets;
}

function sortPatches(assets) {
  Logger.info({ assets }, 'Assets to sort');
  if (Array.isArray(assets)) {
    return assets.map((asset) => {
      if (Array.isArray(asset['specific_data-data-security_patches'])) {
        asset['specific_data-data-security_patches'] = asset['specific_data-data-security_patches'].sort(
          (a, b) => new Date(b.installed_on) - new Date(a.installed_on)
        );
      }
      return asset;
    });
  }

  return assets;
}

function formatAssets(assets) {
  return sortPatches(sortPorts(dotsToDashes(removeNullAndEmptyValues(assets))));
}

function doLookup(entities, options, cb) {
  let lookupResults = [];
  let tasks = [];
  options.url = options.url.endsWith('/') ? options.url : `${options.url}/`;

  Logger.debug({ entities }, 'doLookup entities');

  if (USE_TEST_DATA) {
    const transformedAsset = {
      entity: entities[0],
      data: {
        summary: [`${testAssets.assets.length} asset${testAssets.assets.length > 1 ? 's' : ''}`],
        details: {
          assets: formatAssets(testAssets.assets)
        }
      }
    };

    Logger.info({ transformedAsset }, 'Modified Tests Assets');
    return cb(null, [transformedAsset]);
  }

  entities.forEach((entity) => {
    let requestOptions = {
      method: 'POST',
      headers: {
        'api-key': options.apiKey,
        'api-secret': options.apiSecret
      }
    };

    if (entity.isDomain || entity.types.includes('custom.hostname')) {
      requestOptions.uri = `${options.url}api/v2/assets/devices`;
      requestOptions.body = getHostnameQuery(entity, options);
    } else if (entity.isIPv4) {
      requestOptions.uri = `${options.url}api/v2/assets/devices`;
      requestOptions.body = getIpQuery(entity, options);
    } else if (entity.isEmail) {
      requestOptions.uri = `${options.url}api/v2/assets/users`;
      requestOptions.body = getUserQuery(entity, options);
    } else {
      return;
    }

    Logger.trace({ uri: requestOptions }, 'Request URI');

    tasks.push(function (done) {
      requestWithDefaults(requestOptions, function (error, res, body) {
        if (error) {
          return done(error);
        }

        Logger.trace({ requestOptions }, 'Request Options');

        let result = {};

        if (res.statusCode === 200) {
          result = {
            entity,
            body
          };
        } else if (res.statusCode === 202) {
          result = {
            entity,
            body: null
          };
        } else {
          let error;
          if (res.statusCode === 401) {
            error = {
              err: 'Unauthorized',
              body,
              detail: 'Invalid API key or secret. Ensure your API key and secret are valid.'
            };
          } else if (res.statusCode === 403) {
            error = {
              err: 'Access Denied',
              body,
              detail: 'Not enough access permissions.'
            };
          } else if (res.statusCode === 404) {
            error = {
              err: 'Not Found',
              body,
              detail: "Requested item doesn't exist or not enough access permissions."
            };
          } else if (res.statusCode === 429) {
            error = {
              err: 'Too Many Requests',
              body,
              detail:
                'Daily number of requests exceeds limit. Check Retry-After header to get information about request delay.'
            };
          } else {
            error = {
              err: 'Server Error',
              body,
              detail: 'Unexpected Server Error'
            };
          }

          return done(error);
        }

        done(null, result);
      });
    });
  });

  async.parallelLimit(tasks, MAX_PARALLEL_LOOKUPS, (err, results) => {
    if (err) {
      Logger.error({ err: err }, 'Error');
      cb(err);
      return;
    }

    results.forEach((result) => {
      if (!result.body || !Array.isArray(result.body.assets) || result.body.assets.length === 0) {
        lookupResults.push({
          entity: result.entity,
          data: null
        });
      } else {
        lookupResults.push({
          entity: result.entity,
          data: {
            summary: [`${result.body.assets.length} asset${result.body.assets.length > 1 ? 's' : ''}`],
            details: {
              assets: formatAssets(result.body.assets)
            }
          }
        });
      }
    });

    Logger.debug({ lookupResults }, 'Results');

    cb(null, lookupResults);
  });
}

function validateUrl(errors, url) {
  if (url && url.endsWith('//')) {
    errors.push({
      key: 'url',
      message: 'Your URL must not end with a //'
    });
  }
}

function validateStringOption(errors, options, optionName, errMessage) {
  if (
    typeof options[optionName].value !== 'string' ||
    (typeof options[optionName].value === 'string' && options[optionName].value.length === 0)
  ) {
    errors.push({
      key: optionName,
      message: errMessage
    });
  }
}

function validateOptions(options, callback) {
  let errors = [];

  validateUrl(errors, options.url.value);
  validateStringOption(errors, options, 'url', 'You must provide a valid URL');
  validateStringOption(errors, options, 'apiKey', 'You must provide a valid API Key');
  validateStringOption(errors, options, 'apiSecret', 'You must provide a valid API Secret');

  callback(null, errors);
}

module.exports = {
  doLookup,
  startup,
  validateOptions
};
