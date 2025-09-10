'use strict';

const nock = require('nock');
const { doLookup, startup } = require('../integration');

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  trace: jest.fn(),
  error: jest.fn()
};

describe('Axonius Integration Tests', () => {
  const baseUrl = 'https://test.axonius.com';
  const options = {
    url: baseUrl,
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    searchLimit: 10,
    exactMatchHostname: false
  };

  beforeAll(() => {
    startup(mockLogger);
  });

  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('doLookup - Hostname/Domain Endpoint Tests', () => {
    it('should successfully query devices endpoint for hostname entity', (done) => {
      const mockEntity = {
        value: 'test-hostname',
        isDomain: true,
        types: ['custom.hostname']
      };

      const mockResponse = {
        meta: {
          page: {
            totalResources: 1
          }
        },
        assets: [
          {
            internal_axon_id: 'device-123',
            specific_data: {
              data: {
                name: 'test-hostname',
                hostname: 'test-hostname.domain.com',
                last_seen: '2025-09-09T10:00:00Z'
              }
            }
          }
        ]
      };

      const expectedQuery = {
        include_metadata: true,
        fields: [
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
        ],
        query:
          '(specific_data.data.name == regex("test-hostname", "i")) or (specific_data.data.hostname == regex("test-hostname", "i")) or (specific_data.data.preferred_hostname == regex("test-hostname", "i"))',
        page: {
          offset: 0,
          limit: 10
        }
      };

      nock(baseUrl)
        .post('/api/v2/assets/devices', expectedQuery)
        .matchHeader('api-key', 'test-api-key')
        .matchHeader('api-secret', 'test-api-secret')
        .reply(200, mockResponse);

      doLookup([mockEntity], options, (err, results) => {
        try {
          expect(err).toBeNull();
          expect(results).toHaveLength(1);
          expect(results[0].entity).toBe(mockEntity);
          expect(results[0].data.summary).toEqual(['1 asset']);
          expect(results[0].data.details.assets).toEqual(mockResponse.assets);
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('should handle exact match hostname option', (done) => {
      const mockEntity = {
        value: 'exact-host',
        isDomain: true,
        types: ['custom.hostname']
      };

      const exactMatchOptions = { ...options, exactMatchHostname: true };

      nock(baseUrl)
        .post('/api/v2/assets/devices', (body) => {
          // Parse the body and check the query string
          const expectedQuery =
            '(specific_data.data.name == regex("^exact-host$", "i")) or (specific_data.data.hostname == regex("^exact-host$", "i")) or (specific_data.data.preferred_hostname == regex("^exact-host$", "i"))';
          return (
            body.query === expectedQuery &&
            body.include_metadata === true &&
            body.page.offset === 0 &&
            body.page.limit === 10
          );
        })
        .reply(200, { meta: { page: { totalResources: 0 } }, assets: [] });

      doLookup([mockEntity], exactMatchOptions, (err, results) => {
        try {
          expect(err).toBeNull();
          expect(results[0].data).toBeNull();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });

  describe('doLookup - IP Address Endpoint Tests', () => {
    it('should successfully query devices endpoint for IP entity', (done) => {
      const mockEntity = {
        value: '192.168.1.100',
        isIPv4: true,
        types: ['IPv4']
      };

      const mockResponse = {
        meta: {
          page: {
            totalResources: 2
          }
        },
        assets: [
          {
            id: 'device-456',
            specific_data: {
              data: {
                name: 'server-01',
                network_interfaces: {
                  ips_preferred: ['192.168.1.100']
                },
                last_seen: '2025-09-09T10:00:00Z'
              }
            }
          },
          {
            id: 'device-789',
            specific_data: {
              data: {
                name: 'server-02',
                network_interfaces: {
                  ips_preferred: ['192.168.1.100']
                },
                last_seen: '2025-09-08T15:30:00Z'
              }
            }
          }
        ]
      };

      const expectedQuery = {
        include_metadata: true,
        fields: [
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
        ],
        query: '("specific_data.data.network_interfaces.ips_preferred" == "192.168.1.100")',
        page: {
          offset: 0,
          limit: 10
        }
      };

      nock(baseUrl)
        .post('/api/v2/assets/devices', expectedQuery)
        .matchHeader('api-key', 'test-api-key')
        .matchHeader('api-secret', 'test-api-secret')
        .reply(200, mockResponse);

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeNull();
        expect(results).toHaveLength(1);
        expect(results[0].entity).toBe(mockEntity);
        expect(results[0].data.summary).toEqual(['2 assets']);
        expect(results[0].data.details.assets).toEqual(mockResponse.assets);
        done();
      });
    });

    it('should handle IP with whitespace', (done) => {
      const mockEntity = {
        value: '  10.0.0.1  ',
        isIPv4: true,
        types: ['IPv4']
      };

      const expectedQuery = {
        include_metadata: true,
        fields: [
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
        ],
        query: '("specific_data.data.network_interfaces.ips_preferred" == "10.0.0.1")',
        page: {
          offset: 0,
          limit: 10
        }
      };

      nock(baseUrl)
        .post('/api/v2/assets/devices', expectedQuery)
        .reply(200, { meta: { page: { totalResources: 0 } }, assets: [] });

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeNull();
        expect(results[0].data).toBeNull();
        done();
      });
    });
  });

  describe('doLookup - Email/User Endpoint Tests', () => {
    it('should successfully query users endpoint for email entity', (done) => {
      const mockEntity = {
        value: 'john.doe@company.com',
        isEmail: true,
        types: ['email']
      };

      const mockResponse = {
        meta: {
          page: {
            totalResources: 1
          }
        },
        assets: [
          {
            id: 'user-123',
            specific_data: {
              data: {
                display_name: 'John Doe',
                username: 'john.doe@company.com',
                last_seen: '2025-09-09T09:15:00Z',
                is_local: false,
                is_locked: false,
                employee_id: 'EMP001'
              }
            },
            user_status: 'active',
            groups: ['IT Department', 'Developers']
          }
        ]
      };

      const expectedQuery = {
        include_metadata: true,
        fields: [
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
        ],
        query: '(specific_data.data.username == "john.doe@company.com")',
        page: {
          offset: 0,
          limit: 10
        }
      };

      nock(baseUrl)
        .post('/api/v2/users', expectedQuery)
        .matchHeader('api-key', 'test-api-key')
        .matchHeader('api-secret', 'test-api-secret')
        .reply(200, mockResponse);

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeNull();
        expect(results).toHaveLength(1);
        expect(results[0].entity).toBe(mockEntity);
        expect(results[0].data.summary).toEqual(['1 asset']);
        expect(results[0].data.details.assets).toEqual(mockResponse.assets);
        done();
      });
    });

    it('should handle email with whitespace', (done) => {
      const mockEntity = {
        value: '  test@example.com  ',
        isEmail: true,
        type: 'email',
        types: ['email']
      };

      const expectedQuery = {
        include_metadata: true,
        fields: expect.any(Array),
        query: '(specific_data.data.username == "test@example.com")',
        page: {
          offset: 0,
          limit: 10
        }
      };

      nock(baseUrl)
        .post('/api/v2/users', expectedQuery)
        .reply(200, { meta: { page: { totalResources: 0 } }, assets: [] });

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeNull();
        expect(results[0].data).toBeNull();
        done();
      });
    });
  });

  describe('doLookup - Error Handling Tests', () => {
    it('should handle 401 Unauthorized error', (done) => {
      const mockEntity = {
        value: 'test-host',
        isDomain: true,
        types: ['custom.hostname']
      };

      nock(baseUrl).post('/api/v2/assets/devices').reply(401, { error: 'Unauthorized' });

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeDefined();
        expect(err.err).toBe('Unauthorized');
        expect(err.detail).toBe('Invalid API key or secret. Ensure your API key and secret are valid.');
        done();
      });
    });

    it('should handle 403 Access Denied error', (done) => {
      const mockEntity = {
        value: '192.168.1.1',
        isIPv4: true,
        types: ['IPv4']
      };
      nock(baseUrl).post('/api/v2/assets/devices').reply(403, { error: 'Forbidden' });

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeDefined();
        expect(err.err).toBe('Access Denied');
        expect(err.detail).toBe('Not enough access permissions.');
        done();
      });
    });

    it('should handle 404 Not Found error', (done) => {
      const mockEntity = {
        value: 'user@test.com',
        isEmail: true,
        types: ['email']
      };

      nock(baseUrl).post('/api/v2/users').reply(404, { error: 'Not Found' });

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeDefined();
        expect(err.err).toBe('Not Found');
        expect(err.detail).toBe("Requested item doesn't exist or not enough access permissions.");
        done();
      });
    });

    it('should handle 429 Too Many Requests error', (done) => {
      const mockEntity = {
        value: 'test-host',
        isDomain: true,
        types: ['custom.hostname']
      };

      nock(baseUrl).post('/api/v2/assets/devices').reply(429, { error: 'Rate Limited' });

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeDefined();
        expect(err.err).toBe('Too Many Requests');
        expect(err.detail).toBe(
          'Daily number of requests exceeds limit. Check Retry-After header to get information about request delay.'
        );
        done();
      });
    });

    it('should handle 500 Server Error', (done) => {
      const mockEntity = {
        value: '10.0.0.1',
        isIPv4: true,
        types: ['IPv4']
      };

      nock(baseUrl).post('/api/v2/assets/devices').reply(500, { error: 'Internal Server Error' });

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeDefined();
        expect(err.err).toBe('Server Error');
        expect(err.detail).toBe('Unexpected Server Error');
        done();
      });
    });

    it('should handle network errors', (done) => {
      const mockEntity = {
        value: 'test@example.com',
        isEmail: true,
        types: ['email']
      };

      nock(baseUrl).post('/api/v2/users').replyWithError('Network error');

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeDefined();
        expect(err.message).toBe('Network error');
        done();
      });
    });
  });

  describe('doLookup - Mixed Entity Types Tests', () => {
    it('should handle multiple entity types in single request', (done) => {
      const entities = [
        {
          value: 'test-hostname',
          isDomain: true,
          types: ['custom.hostname']
        },
        {
          value: '192.168.1.100',
          isIPv4: true,
          types: ['IPv4']
        },
        {
          value: 'user@company.com',
          isEmail: true,
          types: ['email']
        }
      ];

      const deviceResponse = {
        meta: { page: { totalResources: 1 } },
        assets: [{ id: 'device-1', specific_data: { data: { name: 'test-host' } } }]
      };

      const ipResponse = {
        meta: { page: { totalResources: 0 } },
        assets: []
      };

      const userResponse = {
        meta: { page: { totalResources: 1 } },
        assets: [{ id: 'user-1', specific_data: { data: { username: 'user@company.com' } } }]
      };

      // Mock hostname request
      nock(baseUrl).post('/api/v2/assets/devices').reply(200, deviceResponse);

      // Mock IP request
      nock(baseUrl).post('/api/v2/assets/devices').reply(200, ipResponse);

      // Mock user request
      nock(baseUrl).post('/api/v2/users').reply(200, userResponse);

      doLookup(entities, options, (err, results) => {
        expect(err).toBeNull();
        expect(results).toHaveLength(3);

        // Check hostname result
        expect(results[0].entity).toBe(entities[0]);
        expect(results[0].data.summary).toEqual(['1 asset']);

        // Check IP result (no results)
        expect(results[1].entity).toBe(entities[1]);
        expect(results[1].data).toBeNull();

        // Check user result
        expect(results[2].entity).toBe(entities[2]);
        expect(results[2].data.summary).toEqual(['1 asset']);

        done();
      });
    });

    it('should handle 202 Accepted responses', (done) => {
      const mockEntity = {
        value: 'test-host',
        isDomain: true,
        types: ['custom.hostname']
      };

      nock(baseUrl).post('/api/v2/assets/devices').reply(202);

      doLookup([mockEntity], options, (err, results) => {
        expect(err).toBeNull();
        expect(results).toHaveLength(1);
        expect(results[0].entity).toBe(mockEntity);
        expect(results[0].data).toBeNull();
        done();
      });
    });

    it('should skip unsupported entity types', (done) => {
      const entities = [
        {
          value: 'unsupported-entity',
          types: ['unsupported']
        },
        {
          value: 'test-host',
          isDomain: true,
          types: ['custom.hostname']
        }
      ];

      nock(baseUrl)
        .post('/api/v2/assets/devices')
        .reply(200, { meta: { page: { totalResources: 0 } }, assets: [] });

      doLookup(entities, options, (err, results) => {
        expect(err).toBeNull();
        expect(results).toHaveLength(1); // Only supported entity should be processed
        expect(results[0].entity).toBe(entities[1]);
        done();
      });
    });
  });

  describe('doLookup - URL Handling Tests', () => {
    it('should handle URL without trailing slash', (done) => {
      const urlWithoutSlash = 'https://test.axonius.com';
      const optionsWithoutSlash = { ...options, url: urlWithoutSlash };

      const mockEntity = {
        value: 'test-host',
        isDomain: true,
        types: ['custom.hostname']
      };

      nock(urlWithoutSlash)
        .post('/api/v2/assets/devices')
        .reply(200, { meta: { page: { totalResources: 0 } }, assets: [] });

      doLookup([mockEntity], optionsWithoutSlash, (err, results) => {
        expect(err).toBeNull();
        expect(results).toHaveLength(1);
        done();
      });
    });

    it('should handle URL with trailing slash', (done) => {
      const urlWithSlash = 'https://test.axonius.com/';
      const optionsWithSlash = { ...options, url: urlWithSlash };

      const mockEntity = {
        value: 'test-host',
        isDomain: true,
        types: ['custom.hostname']
      };

      nock('https://test.axonius.com')
        .post('/api/v2/assets/devices')
        .reply(200, { meta: { page: { totalResources: 0 } }, assets: [] });

      doLookup([mockEntity], optionsWithSlash, (err, results) => {
        expect(err).toBeNull();
        expect(results).toHaveLength(1);
        done();
      });
    });
  });
});
