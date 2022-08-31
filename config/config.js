module.exports = {
  /**
   * Name of the integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @required
   */
  name: 'Axonius',
  /**
   * The acronym that appears in the notification window when information from this integration
   * is displayed.  Note that the acronym is included as part of each "tag" in the summary information
   * for the integration.  As a result, it is best to keep it to 4 or less characters.  The casing used
   * here will be carried forward into the notification window.
   *
   * @type String
   * @required
   */
  acronym: 'AXON',
  /**
   * Description for this integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @optional
   */
  description:
    'Axonius cybersecurity asset management solutions offer a comprehensive IT asset inventory, empowering users to enforce their network security policies.',
  entityTypes: ['IPv4', 'domain', 'email'],
  customTypes: [
    {
      key: 'hostname',
      // Captures "hostnames" between 5 and 25 characters where valid characters are a-z, A-Z, 0-9 and a dash.
      // Ensures that the hostname is not part of a larger piece of text by rejecting any text with newlines
      // before or after the hostname.  Does allow for spaces and tabs to occur before or after the hostname.
      regex: /^(?<!\n|\r\n)[ \t]*[a-zA-Z0-9\-]{5,25}[ \t]*(?!\n|\r\n)$/
    }
  ],
  onDemandOnly: true,
  styles: ['./styles/style.less'],
  defaultColor: 'light-blue',
  /**
   * Provide custom component logic and template for rendering the integration details block.  If you do not
   * provide a custom template and/or component then the integration will display data as a table of key value
   * pairs.
   *
   * @type Object
   * @optional
   */
  block: {
    component: {
      file: './components/block.js'
    },
    template: {
      file: './templates/block.hbs'
    }
  },
  request: {
    // Provide the path to your certFile. Leave an empty string to ignore this option.
    // Relative paths are relative to the Axonius integration's root directory
    cert: '',
    // Provide the path to your private key. Leave an empty string to ignore this option.
    // Relative paths are relative to the Axonius integration's root directory
    key: '',
    // Provide the key passphrase if required.  Leave an empty string to ignore this option.
    // Relative paths are relative to the Axonius integration's root directory
    passphrase: '',
    // Provide the Certificate Authority. Leave an empty string to ignore this option.
    // Relative paths are relative to the Axonius integration's root directory
    ca: '',
    // An HTTP proxy to be used. Supports proxy Auth with Basic Auth, identical to support for
    // the url parameter (by embedding the auth info in the uri)
    proxy: '',
    rejectUnauthorized: true
  },
  logging: {
    level: 'info' //trace, debug, info, warn, error, fatal
  },
  /**
   * Options that are displayed to the user/admin in the Polarity integration user-interface.  Should be structured
   * as an array of option objects.
   *
   * @type Array
   * @optional
   */
  options: [
    {
      key: 'url',
      name: 'Axonius URL',
      description: 'The base URL for your Axonius instance including the schema (i.e., https://myaxonius)',
      type: 'text',
      default: '',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'apiKey',
      name: 'API Key',
      description: 'Valid Axonius API Key.',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'apiSecret',
      name: 'API Secret',
      description: 'Valid Axonius API Secret.',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchLimit',
      name: 'Search Result Limit',
      description: 'Maximum number of query results to return in the Polarity overlay.',
      default: 10,
      type: 'number',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'exactMatchHostname',
      name: 'Only return exact matches for hostnames',
      description: 'If checked, the integration will only return exact matches on hostnames.',
      default: false,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    }
  ]
};
