import { commonProtocol } from '@hicommonwealth/model';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ServerThreadsController } from 'server/controllers/server_threads_controller';
import Sinon from 'sinon';
import { BAN_CACHE_MOCK_FN } from 'test/util/banCacheMock';
import { afterEach, beforeEach, describe, test } from 'vitest';

chai.use(chaiAsPromised);

describe('ServerThreadsController', () => {
  beforeEach(() => {
    Sinon.stub(commonProtocol.contractHelpers, 'getNamespaceBalance').resolves({
      '0x123': '0',
    });
  });
  afterEach(() => {
    Sinon.restore();
  });
  describe('#createThreadReaction', () => {
    test('should create a thread reaction (new reaction)', async () => {
      const sandbox = Sinon.createSandbox();
      const db = {
        // for findAllRoles
        Address: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        Group: {
          findAll: async () => [],
        },
        Topic: {
          findOne: async () => ({
            group_ids: [],
          }),
        },
        Reaction: {
          findOne: sandbox.stub().resolves({
            id: 2,
            community_id: 'ethereum',
            Address: {
              address: '0x123',
              community_id: 'ethereum',
            },
            destroy: sandbox.stub(),
            toJSON: () => ({}),
          }),
          findOrCreate: sandbox.stub().resolves([
            {
              id: 2,
              community_id: 'ethereum',
              Address: {
                address: '0x123',
                community_id: 'ethereum',
              },
              destroy: sandbox.stub(),
              toJSON: () => ({}),
            },
            false,
          ]),
        },
        Thread: {
          findOne: sandbox.stub().resolves({
            id: 4,
            title: 'Big Thread!',
            community_id: 'ethereum',
          }),
        },
        CommunityStake: {
          findOne: sandbox.stub().resolves({
            id: 5,
            stake_id: 1,
            vote_weight: 1,
          }),
        },

        Community: {
          findByPk: async () => ({
            id: 'ethereum',
            namespace: 'cake',
          }),
        },
        ChainNode: {
          findByPk: async () => ({
            eth_chain_id: 8453,
            url: 'test.com',
          }),
        },
        sequelize: {
          transaction: async (callback) => {
            return callback();
          },
          query: sandbox.stub().resolves([]),
        },
      };
      const user = {
        getAddresses: sandbox.stub().resolves([{ id: 1, verified: true }]),
      };
      const address = {
        address: '0x123',
        community_id: 'ethereum',
      };
      const chain = {
        id: 'ethereum',
      };
      const banCache = BAN_CACHE_MOCK_FN(chain.id);
      const reaction = {};
      const threadId = 123;

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      const [newReaction, notificationOptions, analyticsOptions] =
        await serverThreadsController.createThreadReaction({
          user: user as any,
          address: address as any,
          reaction: reaction as any,
          threadId: threadId,
        });

      expect(
        serverThreadsController.createThreadReaction({
          user: user as any,
          address: {
            ...(address as any),
            address: '0xbanned',
          },
          reaction: reaction as any,
          threadId: threadId,
        }),
      ).to.be.rejectedWith('Ban error: banned');

      expect(newReaction).to.be.ok;

      expect(notificationOptions).to.have.property('notification');
      const { notification } = notificationOptions;
      expect(notification).to.have.property('categoryId', 'new-reaction');

      expect(notification.data).to.have.property('created_at');
      expect(notification.data).to.include({
        thread_id: 4,
        root_title: 'Big Thread!',
        root_type: 'discussion',
        community_id: 'ethereum',
        author_address: '0x123',
        author_community_id: 'ethereum',
      });

      expect(notificationOptions).to.have.property('excludeAddresses');
      const { excludeAddresses } = notificationOptions;
      // @ts-expect-error StrictNullChecks
      expect(excludeAddresses[0]).to.equal('0x123');

      expect(analyticsOptions).to.include({
        event: 'Create New Reaction',
        community: 'ethereum',
      });
    });

    test('should throw error (thread not found)', () => {
      const sandbox = Sinon.createSandbox();
      const db = {
        Reaction: {
          findOne: sandbox.stub().resolves({
            id: 2,
            chain: 'ethereum',
            Address: {
              address: '0x123',
              community_id: 'ethereum',
            },
            destroy: sandbox.stub(),
            toJSON: () => ({}),
          }),
          findOrCreate: sandbox.stub().resolves([
            {
              id: 2,
              chain: 'ethereum',
              Address: {
                address: '0x123',
                community_id: 'ethereum',
              },
              destroy: sandbox.stub(),
              toJSON: () => ({}),
            },
            false,
          ]),
        },
        Thread: {
          findOne: sandbox.stub().resolves(null),
        },
        sequelize: {
          query: sandbox.stub().resolves([]),
        },
      };
      const banCache = {
        checkBan: sandbox.stub().resolves([true, null]),
      };

      const user = {
        getAddresses: sandbox.stub().resolves([{ id: 1, verified: true }]),
      };
      const address = {};
      const reaction = {};

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      expect(
        serverThreadsController.createThreadReaction({
          user: user as any,
          address: address as any,
          reaction: reaction as any,
          threadId: 123,
        }),
      ).to.be.rejectedWith('Thread not found: 123');
    });

    test('should throw an error (thread archived)', () => {
      const sandbox = Sinon.createSandbox();
      const db = {
        Reaction: {
          findOne: sandbox.stub().resolves({
            id: 2,
            chain: 'ethereum',
            Address: {
              address: '0x123',
              community_id: 'ethereum',
            },
            destroy: sandbox.stub(),
            toJSON: () => ({}),
          }),
          findOrCreate: sandbox.stub().resolves([
            {
              id: 2,
              chain: 'ethereum',
              Address: {
                address: '0x123',
                community_id: 'ethereum',
              },
              destroy: sandbox.stub(),
              toJSON: () => ({}),
            },
            false,
          ]),
        },
        Thread: {
          findOne: sandbox.stub().resolves({
            id: 4,
            title: 'Big Thread!',
            community_id: 'ethereum',
            archived_at: Date.now(),
          }),
        },
      };
      const banCache = {
        checkBan: sandbox.stub().resolves([true, null]),
      };

      const user = {
        getAddresses: sandbox.stub().resolves([{ id: 1, verified: true }]),
      };
      const address = {};
      const reaction = {};
      const threadId = 123;

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      expect(
        serverThreadsController.createThreadReaction({
          user: user as any,
          address: address as any,
          reaction: reaction as any,
          threadId,
        }),
      ).to.be.rejectedWith('Thread is archived');
    });

    test('should throw error (banned)', () => {
      const sandbox = Sinon.createSandbox();
      const db = {
        Reaction: {
          findOne: sandbox.stub().resolves({
            id: 2,
            chain: 'ethereum',
            Address: {
              address: '0x123',
              community_id: 'ethereum',
            },
            destroy: sandbox.stub(),
            toJSON: () => ({}),
          }),
          findOrCreate: sandbox.stub().resolves([
            {
              id: 2,
              chain: 'ethereum',
              Address: {
                address: '0x123',
                community_id: 'ethereum',
              },
              destroy: sandbox.stub(),
              toJSON: () => ({}),
            },
            false,
          ]),
        },
        Thread: {
          findOne: sandbox.stub().resolves({
            id: 4,
            title: 'Big Thread!',
            community_id: 'ethereum',
          }),
        },
        sequelize: {
          query: sandbox.stub().resolves([]),
        },
      };
      const banCache = {
        checkBan: sandbox.stub().resolves([false, 'big ban err']),
      };

      const user = {
        getAddresses: sandbox.stub().resolves([{ id: 1, verified: true }]),
      };
      const address = {};
      const reaction = {};
      const threadId = 123;

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      expect(
        serverThreadsController.createThreadReaction({
          user: user as any,
          address: address as any,
          reaction: reaction as any,
          threadId,
        }),
      ).to.be.rejectedWith('Ban error: big ban err');
    });

    test('should throw error (token balance)', () => {
      const sandbox = Sinon.createSandbox();
      const fakeMembershipReject =
        'User does not have permission to perform action CREATE_THREAD_REACTION';
      const db = {
        Reaction: {
          findOne: sandbox.stub().resolves({
            id: 2,
            chain: 'ethereum',
            Address: {
              address: '0x123',
              community_id: 'ethereum',
            },
            destroy: sandbox.stub(),
            toJSON: () => ({}),
          }),
          findOrCreate: sandbox.stub().resolves([
            {
              id: 2,
              chain: 'ethereum',
              Address: {
                address: '0x123',
                community_id: 'ethereum',
              },
              destroy: sandbox.stub(),
              toJSON: () => ({}),
            },
            false,
          ]),
        },
        Thread: {
          findOne: sandbox.stub().resolves({
            id: 4,
            title: 'Big Thread!',
            community_id: 'ethereum',
            topic_id: 77,
          }),
        },
        // for validateTopicThreshold
        Topic: {
          findOne: sandbox.stub().resolves({
            community: {
              ChainNode: {
                id: 99,
              },
            },
            group_ids: [1],
          }),
        },
        CommunityContract: {
          findOne: sandbox.stub().resolves({}),
        },
        // for findAllRoles
        Address: {
          findAll: sandbox.stub().resolves([]),
        },
        Group: {
          findAll: sandbox.stub().resolves([
            {
              id: 1,
              community_id: 'community-trial',
              metadata: {
                name: 'TRIAL Holders',
                description: 'Autogenerated',
                required_requirements: 1,
              },
              requirements: [
                {
                  rule: 'threshold',
                  data: {
                    threshold: '1',
                    source: {
                      source_type: 'erc721',
                      evm_chain_id: 1,
                      contract_address:
                        '0x301A373beBF0160c0583394855D5b10d00a4168a',
                    },
                  },
                },
              ],
              created_at: new Date(),
              updated_at: new Date(),
            },
          ]),
        },
        Membership: {
          findOne: sandbox.stub().resolves({
            group_id: 1,
            last_checked: new Date(),
            reject_reason: fakeMembershipReject,
          }),
          findAll: sandbox.stub().resolves([
            {
              group_id: 1,
              last_checked: new Date(),
              reject_reason: fakeMembershipReject,
            },
          ]),
          bulkCreate: sandbox.stub().resolves([]),
        },
        sequelize: {
          query: sandbox.stub().resolves([]),
        },
      };
      const banCache = {
        checkBan: sandbox.stub().resolves([true, null]),
      };

      const user = {
        getAddresses: sandbox.stub().resolves([{ id: 1, verified: true }]),
      };
      const address = {
        address: '0x123',
      };
      const reaction = {};
      const threadId = 123;

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      expect(
        serverThreadsController.createThreadReaction({
          user: user as any,
          address: address as any,
          reaction: reaction as any,
          threadId,
        }),
      ).to.be.rejectedWith(
        `Failed to create reaction: ${fakeMembershipReject}`,
      );
    });
  });

  describe('#createThreadComment', () => {
    test('should create a thread comment', async () => {
      const address = {
        id: 1,
        address: '0x123',
        save: async () => ({}),
        toJSON: () => ({
          id: 1,
          address: '0x123',
        }),
      };
      const user = {
        id: 1,
        save: async () => ({}),
        getAddresses: async () => [address],
      };
      const parentId = null;
      const threadId = 1;
      const text = 'hello';

      const db = {
        Thread: {
          findOne: async () => ({
            community_id: 'ethereum',
            save: async () => ({}),
          }),
        },
        // for findAllRoles
        Address: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        sequelize: {
          transaction: async (callback: () => any) => callback(),
          query: () => Promise.resolve([]),
        },
        Comment: {
          create: async (data) => {
            return {
              id: 1,
              ...data,
              community_id: 'ethereum',
              toJSON: () => ({
                id: 1,
                ...data,
                community_id: 'ethereum',
              }),
            };
          },
        },
        CommentVersionHistory: {
          create: () => null,
        },
        Subscription: {
          bulkCreate: async () => ({}),
        },
        Topic: {
          findOne: async () => ({
            group_ids: [],
          }),
        },
        Group: {
          findAll: async () => [],
        },
      };
      const banCache = {
        checkBan: () => [true, null],
      };

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      const [newComment, notificationOptions, analyticsOptions] =
        await serverThreadsController.createThreadComment({
          user: user as any,
          address: address as any,
          // @ts-expect-error StrictNullChecks
          parentId,
          threadId,
          text,
          canvasHash: undefined,
          canvasSignedData: undefined,
        });

      expect(newComment).to.include({
        thread_id: threadId,
        text,
        address_id: address.id,
        community_id: 'ethereum',
      });
      expect(notificationOptions).to.have.length.greaterThan(0);
      expect(analyticsOptions).to.include({
        event: 'Create New Comment',
        community: 'ethereum',
      });
    });

    test('should throw error (banned)', () => {
      const db = {
        Thread: {
          findOne: async () => ({
            save: async () => ({}),
          }),
        },
        // for findAllRoles
        CommunityRole: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        sequelize: {
          transaction: async () => ({
            rollback: async () => ({}),
            commit: async () => ({}),
          }),
          query: () => Promise.resolve([]),
        },
        Comment: {
          create: async () => ({}),
          findOne: async () => ({
            Address: {
              id: 1,
              address: '0x123',
            },
            destroy: async () => ({}),
            toJSON: () => ({}),
          }),
        },
        Subscription: {
          create: async () => ({}),
        },
      };
      const banCache = {
        checkBan: async () => [false, 'big bad error'],
      };

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      const user = {};
      const address = {
        id: 1,
        address: '0x123',
        save: async () => ({}),
      };
      const parentId = null;
      const threadId = 1;
      const text = 'hello';

      expect(
        serverThreadsController.createThreadComment({
          user: user as any,
          address: address as any,
          // @ts-expect-error StrictNullChecks
          parentId,
          threadId,
          text,
          canvasHash: undefined,
          canvasSignedData: undefined,
        }),
      ).to.be.rejectedWith('Ban error: big bad error');
    });

    test('should throw error (thread not found)', () => {
      const db = {
        Thread: {
          findOne: async () => null,
        },
        // for findAllRoles
        CommunityRole: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        sequelize: {
          transaction: async () => ({
            rollback: async () => ({}),
            commit: async () => ({}),
          }),
          query: () => Promise.resolve([]),
        },
        Comment: {
          create: async () => ({}),
          findOne: async () => ({
            Address: {
              id: 1,
              address: '0x123',
            },
            destroy: async () => ({}),
            toJSON: () => ({}),
          }),
        },
        Subscription: {
          create: async () => ({}),
        },
      };
      const banCache = {
        checkBan: async () => [true, null],
      };

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      const user = {};
      const address = {
        id: 1,
        address: '0x123',
        save: async () => ({}),
      };
      const parentId = null;
      const threadId = 1;
      const text = 'hello';

      expect(
        serverThreadsController.createThreadComment({
          user: user as any,
          address: address as any,
          // @ts-expect-error StrictNullChecks
          parentId,
          threadId,
          text,
          canvasHash: undefined,
          canvasSignedData: undefined,
        }),
      ).to.be.rejectedWith('Thread not found');
    });

    test('should throw an error (thread archived)', () => {
      const user = {};
      const address = {
        id: 1,
        address: '0x123',
        save: async () => ({}),
      };
      const chain = {
        id: 'ethereum',
        network: 'ethereum',
      };
      const parentId = null;
      const threadId = 1;
      const text = 'hello';

      const db = {
        Thread: {
          findOne: async () => ({
            archived_at: Date.now(),
            save: async () => ({}),
          }),
        },
        // for findAllRoles
        Address: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        sequelize: {
          transaction: async () => ({
            rollback: async () => ({}),
            commit: async () => ({}),
          }),
          query: () => Promise.resolve([]),
        },
        Comment: {
          create: async (data) => ({
            id: 1,
            ...data,
          }),
          findOne: async () => {
            const data = {
              id: 1,
              thread_id: threadId,
              text,
              address_id: address.id,
              chain: chain.id,
              Address: address,
            };
            return {
              ...data,
              destroy: async () => ({}),
              toJSON: () => data,
            };
          },
        },
        Subscription: {
          create: async () => ({}),
        },
      };
      const banCache = {
        checkBan: async () => [true, null],
      };

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      expect(
        serverThreadsController.createThreadComment({
          user: user as any,
          address: address as any,
          // @ts-expect-error StrictNullChecks
          parentId,
          threadId,
          text,
          canvasHash: undefined,
          canvasSignedData: undefined,
        }),
      ).to.be.rejectedWith('Thread is archived');
    });

    test('should throw error (thread readonly)', () => {
      const db = {
        Thread: {
          findOne: async () => ({
            read_only: true,
            save: async () => ({}),
          }),
        },
        // for findAllRoles
        CommunityRole: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        sequelize: {
          transaction: async () => ({
            rollback: async () => ({}),
            commit: async () => ({}),
          }),
          query: () => Promise.resolve([]),
        },
        Comment: {
          create: async () => ({}),
          findOne: async () => ({
            Address: {
              id: 1,
              address: '0x123',
            },
            destroy: async () => ({}),
            toJSON: () => ({}),
          }),
        },
        Subscription: {
          create: async () => ({}),
        },
      };
      const banCache = {
        checkBan: async () => [true, null],
      };

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      const user = {};
      const address = {
        id: 1,
        address: '0x123',
        save: async () => ({}),
      };
      const parentId = null;
      const threadId = 1;
      const text = 'hello';

      expect(
        serverThreadsController.createThreadComment({
          user: user as any,
          address: address as any,
          // @ts-expect-error StrictNullChecks
          parentId,
          threadId,
          text,
          canvasHash: undefined,
          canvasSignedData: undefined,
        }),
      ).to.be.rejectedWith('Cannot comment when thread is read_only');
    });

    test('should throw error (invalid parent)', () => {
      const parentId = 3;

      const db = {
        Thread: {
          findOne: async () => ({
            save: async () => ({}),
          }),
        },
        // for findAllRoles
        CommunityRole: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        sequelize: {
          transaction: async () => ({
            rollback: async () => ({}),
            commit: async () => ({}),
          }),
          query: () => Promise.resolve([]),
        },
        Comment: {
          create: async () => ({}),
          // for parent ID, return null comment
          findOne: async ({ where }) =>
            where.id === parentId
              ? null
              : {
                  Address: {
                    id: 1,
                    address: '0x123',
                  },
                  destroy: async () => ({}),
                  toJSON: () => ({}),
                },
        },
        Subscription: {
          create: async () => ({}),
        },
      };
      const banCache = {
        checkBan: async () => [true, null],
      };

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      const user = {};
      const address = {
        id: 1,
        address: '0x123',
        save: async () => ({}),
      };
      const threadId = 1;
      const text = 'hello';

      expect(
        serverThreadsController.createThreadComment({
          user: user as any,
          address: address as any,
          parentId,
          threadId,
          text,
          canvasHash: undefined,
          canvasSignedData: undefined,
        }),
      ).to.be.rejectedWith('Invalid parent');
    });

    test('should throw error (nesting too deep)', () => {
      const db = {
        Thread: {
          findOne: async () => ({
            save: async () => ({}),
          }),
        },
        // for findAllRoles
        CommunityRole: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        sequelize: {
          transaction: async () => ({
            rollback: async () => ({}),
            commit: async () => ({}),
          }),
          query: async () => [{ max_depth_reached: true, comment_depth: 8 }],
        },
        Comment: {
          create: async () => ({}),
          findOne: async () => ({
            id: 2,
            parent_id: 1, // simulate infinite nesting
            Address: {
              id: 1,
              address: '0x123',
            },
            destroy: async () => ({}),
            toJSON: () => ({}),
          }),
        },
        Subscription: {
          create: async () => ({}),
        },
      };
      const banCache = {
        checkBan: async () => [true, null],
      };

      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );

      const user = {};
      const address = {
        id: 1,
        address: '0x123',
        save: async () => ({}),
      };
      const parentId = 1;
      const threadId = 1;
      const text = 'hello';

      expect(
        serverThreadsController.createThreadComment({
          user: user as any,
          address: address as any,
          parentId,
          threadId,
          text,
          canvasHash: undefined,
          canvasSignedData: undefined,
        }),
      ).to.be.rejectedWith('Comments can only be nested 8 levels deep');
    });
  });

  describe('#deleteThread', () => {
    test('should delete a thread', async () => {
      const db = {
        Thread: {
          findOne: async () => ({
            id: 1,
            community_id: 'ethereum',
            address_id: 1,
            Address: {
              id: 1,
              address: '0x123',
            },
            destroy: async () => ({}),
          }),
          destroy: async () => ({}),
        },
        CommunityRole: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        Subscription: {
          destroy: async () => ({}),
        },
        Address: {
          findAll: async () => [{}], // used in findOneRole
        },
        sequelize: {
          transaction: async (callback) => callback({}),
          query: () => Promise.resolve([]),
        },
      };
      const banCache = BAN_CACHE_MOCK_FN('ethereum');
      const address = {
        address: '0x123',
      };
      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );
      const user = {
        getAddresses: async () => [{ id: 1, address: '0x123', verified: true }],
      };
      const threadId = 1;
      await serverThreadsController.deleteThread({
        user: user as any,
        threadId,
        address: address as any,
      });

      expect(
        serverThreadsController.deleteThread({
          user: user as any,
          threadId,
          address: {
            ...(address as any),
            address: '0xbanned',
          },
        }),
      ).to.be.rejectedWith('Ban error: banned');
    });

    test('should should throw error (thread not found)', () => {
      const db = {
        Thread: {
          findOne: async () => null,
          destroy: async () => ({}),
        },
        CommunityRole: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        Subscription: {
          destroy: async () => ({}),
        },
        sequelize: {
          query: () => Promise.resolve([]),
        },
      };
      const banCache = {
        checkBan: async () => [true, null],
      };
      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );
      const user = {
        getAddresses: async () => [{ id: 1, address: '0x123', verified: true }],
      };
      const threadId = 1;
      const address = {
        address: '0x123',
      };
      expect(
        serverThreadsController.deleteThread({
          user: user as any,
          threadId,
          address: address as any,
        }),
      ).to.be.rejectedWith('Thread not found: 1');
    });

    test('should throw error (banned)', () => {
      const db = {
        Thread: {
          findOne: async () => ({
            id: 1,
            Address: {
              id: 1,
              address: '0x123',
            },
          }),
          destroy: async () => ({}),
        },
        CommunityRole: {
          findAll: async () => [
            {
              toJSON: () => ({}),
            },
          ],
        },
        Subscription: {
          destroy: async () => ({}),
        },
        sequelize: {
          query: () => Promise.resolve([]),
        },
      };
      const banCache = {
        checkBan: async () => [false, 'bad'],
      };
      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );
      const user = {
        getAddresses: async () => [{ id: 1, address: '0x123', verified: true }],
      };
      const threadId = 1;
      const address = {
        address: '0x123',
      };
      expect(
        serverThreadsController.deleteThread({
          user: user as any,
          threadId,
          address: address as any,
        }),
      ).to.be.rejectedWith('Ban error: bad');
    });

    test('should throw error (not owned)', () => {
      const db = {
        Thread: {
          findOne: async () => ({
            id: 1,
            Address: {
              id: 1,
              address: '0x123',
            },
          }),
          destroy: async () => ({}),
        },
        CommunityRole: {
          findAll: async () => [{}], // no mod/admin roles
        },
        Subscription: {
          destroy: async () => ({}),
        },
        Address: {
          findAll: async () => [{}], // used in findOneRole
        },
        sequelize: {
          query: () => Promise.resolve([]),
        },
      };
      const banCache = {
        checkBan: async () => [true, null],
      };
      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );
      const user = {
        // address is different from thread author
        getAddresses: async () => [{ id: 2, address: '0x124', verified: true }],
      };
      const threadId = 1;
      const address = {
        address: '0x123',
      };
      expect(
        serverThreadsController.deleteThread({
          user: user as any,
          threadId,
          address: address as any,
        }),
      ).to.be.rejectedWith('Not owned by this user');
    });
  });

  describe('#createThread', () => {
    test('should create a thread', async () => {
      let data = {};

      const db = {
        CommunityRole: {
          findAll: async () => [
            {
              toJSON: () => ({
                chain_id: 'ethereum',
                name: 'member',
                allow: '0',
                deny: '0',
                RoleAssignments: [{}],
              }),
            },
          ],
        },
        Chain: {
          findOne: async () => ({}),
        },
        sequelize: {
          transaction: async (callback) => {
            return callback();
          },
          query: async () => ({}),
        },
        Group: {
          findAll: async () => [],
        },
        Topic: {
          findOrCreate: async () => ({}),
          findOne: async () => ({
            group_ids: [],
          }),
        },
        Thread: {
          findOne: async () => ({
            ...data,
            Address: {
              address: '0x123',
              community_id: 'ethereum',
            },
            toJSON: () => ({
              ...data,
              Address: {
                address: '0x123',
                community_id: 'ethereum',
              },
            }),
          }),
          create: async (d) => {
            data = {
              id: 1,
              ...d,
            };
            return data;
          },
        },
        Subscription: {
          bulkCreate: async () => ({}),
        },
        Address: {
          findAll: async () => [{}], // used in findOneRole
        },
        CommentVersionHistory: {
          create: () => null,
        },
        ThreadVersionHistory: {
          create: () => null,
        },
      };
      const banCache = BAN_CACHE_MOCK_FN('ethereum');
      const serverThreadsController = new ServerThreadsController(
        db as any,
        banCache as any,
      );
      const user = {
        getAddresses: async () => [{ id: 1, address: '0x123', verified: true }],
      };
      const address = {
        id: 1,
        address: '0x123',
        chain: 'ethereum',
        save: async () => ({}),
      };
      const chain = {
        id: 'ethereum',
      };
      const body = 'hello';
      const kind = 'discussion';
      const readOnly = false;
      const topicId = 1;
      const title = 'mythread';
      const stage = 'stage';
      const url = 'http://blah';

      const [thread, notificationOptions] =
        await serverThreadsController.createThread({
          user: user as any,
          address: address as any,
          community: chain as any,
          title,
          body,
          kind,
          readOnly,
          topicId,
          stage,
          url,
          canvasHash: undefined,
          canvasSignedData: undefined,
        });

      expect(
        serverThreadsController.createThread({
          user: user as any,
          address: {
            ...(address as any),
            address: '0xbanned',
          },
          community: chain as any,
          title,
          body,
          kind,
          readOnly,
          topicId,
          stage,
          url,
          canvasHash: undefined,
          canvasSignedData: undefined,
        }),
      ).to.be.rejectedWith('Ban error: banned');

      expect(thread.title).to.equal(title);
      expect(thread.body).to.equal(body);
      expect(thread.stage).to.equal(stage);

      expect(notificationOptions).to.have.length(1);
      expect(notificationOptions[0]).to.have.property('notification');
      expect(notificationOptions[0].notification).to.include({
        categoryId: 'new-thread-creation',
      });
      expect(notificationOptions[0].notification.data).to.include({
        thread_id: 1,
        root_type: 'discussion',
        root_title: 'mythread',
        community_id: 'ethereum',
        author_address: '0x123',
        author_community_id: 'ethereum',
      });
      // @ts-expect-error StrictNullChecks
      expect(notificationOptions[0].excludeAddresses[0]).to.equal('0x123');
    });
  });
});
