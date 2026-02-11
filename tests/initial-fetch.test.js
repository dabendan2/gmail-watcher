const GmailWatcher = require('../src/core/watcher');
const fs = require('fs');
const path = require('path');
const { PubSub } = require('@google-cloud/pubsub');

// Mock @google-cloud/pubsub
jest.mock('@google-cloud/pubsub', () => {
  return {
    PubSub: jest.fn().mockImplementation(() => ({
      subscription: jest.fn().mockReturnValue({
        on: jest.fn(),
        close: jest.fn()
      }),
      projectId: 'test-project'
    }))
  };
});

// Mock googleapis via GmailClient internal logic
jest.mock('../src/core/GmailClient', () => {
  return jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({ auth: {} }),
    watch: jest.fn().mockResolvedValue({}),
    listUnreadMessages: jest.fn().mockResolvedValue([{ id: 'msg1' }, { id: 'msg2' }]),
    fetchFullMessages: jest.fn().mockResolvedValue([{ id: 'msg1', snippet: 'test1' }, { id: 'msg2', snippet: 'test2' }])
  }));
});

// Mock HookRunner
jest.mock('../src/core/HookRunner', () => {
  return jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue()
  }));
});

describe('GmailWatcher Initial Fetch Test', () => {
  let watcher;
  const workdir = '/tmp/gmail-watcher-test';

  beforeEach(() => {
    if (!fs.existsSync(workdir)) fs.mkdirSync(workdir, { recursive: true });
    
    // Mock fs
    jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
    
    watcher = new GmailWatcher({
      workdir: workdir,
      topicName: 'test-topic',
      subscriptionName: 'test-sub',
      projectId: 'test-project'
    });

    // Suppress logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('start() should fetch initial unread messages and run hooks', async () => {
    await watcher.start();

    expect(watcher.gmail.listUnreadMessages).toHaveBeenCalledWith(10);
    expect(watcher.gmail.fetchFullMessages).toHaveBeenCalledWith([{ id: 'msg1' }, { id: 'msg2' }]);
    expect(watcher.hookRunner.run).toHaveBeenCalledWith([
      { id: 'msg1', snippet: 'test1' },
      { id: 'msg2', snippet: 'test2' }
    ]);
  });
});
