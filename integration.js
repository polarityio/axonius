'use strict';

const request = require('postman-request');
const config = require('./config/config');
const async = require('async');
const fs = require('fs');
const fp = require('lodash/fp');

let Logger;
let requestWithDefaults;

const MAX_PARALLEL_LOOKUPS = 10;

/**
 *
 * @param entities
 * @param options
 * @param cb
 */
function startup(logger) {
  let defaults = {};
  Logger = logger;

  const { cert, key, passphrase, ca, proxy, rejectUnauthorized } = config.request;

  if (typeof cert === 'string' && cert.length > 0) {
    defaults.cert = fs.readFileSync(cert);
  }

  if (typeof key === 'string' && key.length > 0) {
    defaults.key = fs.readFileSync(key);
  }

  if (typeof passphrase === 'string' && passphrase.length > 0) {
    defaults.passphrase = passphrase;
  }

  if (typeof ca === 'string' && ca.length > 0) {
    defaults.ca = fs.readFileSync(ca);
  }

  if (typeof proxy === 'string' && proxy.length > 0) {
    defaults.proxy = proxy;
  }

  if (typeof rejectUnauthorized === 'boolean') {
    defaults.rejectUnauthorized = rejectUnauthorized;
  }

  requestWithDefaults = request.defaults(defaults);
}

function doLookup(entities, { url, ...optionsWithoutUrl }, cb) {
  let lookupResults = [];
  let tasks = [];
  const options = {
    ...optionsWithoutUrl,
    url: url && url.endsWith('/') ? url.substring(0, url.length - 1) : url
  };
  const flattenObjectKeys = (obj, path = []) =>
    fp.isPlainObject(obj) || fp.isArray(obj)
      ? fp.reduce((acc, [k, v]) => fp.merge(acc, flattenObjectKeys(v, [...path, k])), {}, fp.toPairs(obj))
      : { [path.join('.')]: obj };
  const expandJSON = fp.flow(
    flattenObjectKeys,
    fp.toPairs,
    fp.reduce((acc, [k, v]) => fp.set(k, v, acc), {})
  );

  Logger.debug({ entities }, 'doLookup entities');

  entities.forEach((entity) => {
    let requestOptions = {
      method: 'POST',
      headers: {
        'api-key': options.apiKey,
        'api-secret': options.apiSecret
      },
      json: true
    };

    if (entity.isDomain || entity.types.includes('custom.hostname')) {
      requestOptions.uri = `${options.url}/api/V4.0/devices`;
      requestOptions.body = {
        data: {
          type: 'entity_request_schema',
          attributes: {
            use_cache_entry: false,
            get_metadata: true,
            always_cached_query: false,
            fields: {
              devices: [
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
              ]
            },
            include_details: false,
            filter: `(specific_data.data.name == regex("${entity.value.trim()}", "i")) or ` +
               `(specific_data.data.hostname == regex("${entity.value.trim()}", "i")) or ` +
               `(specific_data.data.preferred_hostname == regex("${entity.value.trim()}", "i"))`,
            use_cursor: true,
            include_notes: false,
            page: {
              offset: 0,
              limit: options.searchLimit
            }
          }
        }
      };
    } else if (entity.isIPv4) {
      requestOptions.uri = `${options.url}/api/V4.0/devices`;
      requestOptions.body = {
        data: {
          type: 'entity_request_schema',
          attributes: {
            use_cache_entry: false,
            get_metadata: true,
            always_cached_query: false,
            fields: {
              devices: [
                'adapters',
                'specific_data.data.name',
                'specific_data.data.hostname',
                'specific_data.data.last_seen',
                'specific_data.data.first_fetch_time',
                'specific_data.data.network_interfaces.ips_preferred',
                'specific_data.data.network_interfaces.mac_preferred',
                'specific_data.data.os.type_distribution',
                'specific_data.data.os.type_distribution_preferred',
                'specific_data.data.last_used_users',
                'specific_data.data.last_used_users_mail_association',
                'specific_data.data.open_ports',
                'specific_data.data.software_cves',
                'specific_data.data.agent_versions',
                'specific_data.data.installed_software',
                'specific_data.data.security_patches',
                'labels'
              ]
            },
            include_details: false,
            filter: '(specific_data.data.network_interfaces.ips_preferred == "' + entity.value + '")',
            use_cursor: true,
            include_notes: false,
            page: {
              offset: 0,
              limit: options.searchLimit
            }
          }
        }
      };
    } else if (entity.isEmail) {
      requestOptions.uri = `${options.url}/api/V4.0/users`;
      requestOptions.body = {
        data: {
          type: 'entity_request_schema',
          attributes: {
            use_cache_entry: false,
            get_metadata: true,
            always_cached_query: false,
            fields: {
              devices: [
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
              ]
            },
            include_details: false,
            filter: '(specific_data.data.username == "' + entity.value.toLowerCase() + '")',
            use_cursor: true,
            include_notes: false,
            page: {
              offset: 0,
              limit: options.searchLimit
            }
          }
        }
      };
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
              detail: 'Requested item doesn’t exist or not enough access permissions.'
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
      if (result.body === null || result.body.meta.page.totalResources === 0) {
        lookupResults.push({
          entity: result.entity,
          data: null
        });
      } else {
        let expandedBody = expandJSON(result.body);
        lookupResults.push({
          entity: result.entity,
          data: {
            summary: getSummaryTags(result.entity, expandedBody),
            details: expandedBody
          }
        });
      }
    });
    Logger.debug({ lookupResults }, 'Results');
    cb(null, lookupResults);
  });
}

function getIp(result) {
  const preferredIps = fp.get('attributes.specific_data.data.network_interfaces.ips_preferred')(result);
  if (Array.isArray(preferredIps) && preferredIps.length > 0) {
    return preferredIps[0];
  }
  return null;
}

function getSummaryTags(entity, expandedBody) {
  const tags = [];
  let isUser = false;
  // Check for specific fields on the first result
  if (expandedBody.data.length > 0) {
    const result = expandedBody.data[0];
    const hostname = fp.get('attributes.specific_data.data.hostname')(result);
    const ip = getIp(result);
    const user = fp.get('attributes.specific_data.data.last_used_users')(result);
    const displayName = fp.get('attributes.specific_data.data.display_name')(result);
    if (entity.isIP && hostname) {
      tags.push(hostname);
    }
    if (entity.isDomain && ip) {
      tags.push(ip);
    }
    if (user) {
      tags.push(`User: ${user}`);
    }
    if (displayName) {
      tags.push(displayName);
      isUser = true;
    }
  }

  // There could be more than one result but we only show specific tags for the first
  // Show how many other results there are
  if (expandedBody.data.length > 1) {
    tags.push(`+${expandedBody.data.length - 1} ${isUser ? 'users' : 'devices'}`);
  }

  // Ensure we have at least one tag
  if (tags.length === 0) {
    tags.push(`${expandedBody.data.length} results`);
  }

  return tags;
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
