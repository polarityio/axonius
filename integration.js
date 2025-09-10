'use strict';

const request = require('postman-request');
const async = require('async');

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

function getIpQuery(entity, options) {
  const entityValue = entity.value.trim();

  return {
    include_metadata: true,
    fields: DEVICE_FIELDS_TO_RETURN,
    query: `("specific_data.data.network_interfaces.ips_preferred" == "${entityValue}")`,
    page: {
      offset: 0,
      limit: options.searchLimit
    }
  };
}

function getHostnameQuery(entity, options) {
  const entityValue = entity.value.trim();

  return {
    include_metadata: true,
    fields: DEVICE_FIELDS_TO_RETURN,
    query: options.exactMatchHostname
      ? `(specific_data.data.name == regex("^${entityValue}$", "i")) or ` +
        `(specific_data.data.hostname == regex("^${entityValue}$", "i")) or ` +
        `(specific_data.data.preferred_hostname == regex("^${entityValue}$", "i"))`
      : `(specific_data.data.name == regex("${entityValue}", "i")) or ` +
        `(specific_data.data.hostname == regex("${entityValue}", "i")) or ` +
        `(specific_data.data.preferred_hostname == regex("${entityValue}", "i"))`,
    page: {
      offset: 0,
      limit: options.searchLimit
    }
  };
}

function getUserQuery(entity, options) {
  const entityValue = entity.value.trim();

  return {
    include_metadata: true,
    fields: USER_DEVICE_FIELDS_TO_RETURN,
    query: `(specific_data.data.username == "${entityValue}")`,
    page: {
      offset: 0,
      limit: options.searchLimit
    }
  };
}

function doLookup(entities, options, cb) {
  let lookupResults = [];
  let tasks = [];
  options.url = options.url.endsWith('/') ? options.url : `${options.url}/`;

  Logger.debug({ entities }, 'doLookup entities');

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
      requestOptions.uri = `${options.url}api/v2/users`;
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
              detail: 'Requested item doesn\'t exist or not enough access permissions.'
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
      if (!result.body || result.body.meta.page.totalResources === 0) {
        lookupResults.push({
          entity: result.entity,
          data: null
        });
      } else {
        // Use totalResources from meta for summary count to match test expectations
        const assetCount = result.body.meta.page.totalResources;
        lookupResults.push({
          entity: result.entity,
          data: {
            summary: [`${assetCount} asset${assetCount > 1 ? 's' : ''}`],
            details: {
              assets: result.body.assets
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
