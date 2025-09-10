const nock = require('nock');

// Global test setup
beforeAll(() => {
  // Disable real HTTP requests during testing
  nock.disableNetConnect();
});

afterAll(() => {
  // Clean up and restore HTTP connections
  nock.cleanAll();
  nock.restore();
  nock.enableNetConnect();
});

// Ensure all nock interceptors are used
afterEach(() => {
  // Check if there are any unused interceptors that could cause hanging
  if (!nock.isDone()) {
    console.warn('Warning: Not all nock interceptors were used');
    nock.cleanAll();
  }
});

// Set a global timeout for async operations
jest.setTimeout(10000);

