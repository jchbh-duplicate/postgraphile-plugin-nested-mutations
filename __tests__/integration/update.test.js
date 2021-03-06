const { graphql } = require('graphql');
const { withSchema } = require('../helpers');

test(
  'forward nested mutation during update',
  withSchema({
    setup: `
      create table p.parent (
        id serial primary key,
        name text not null
      );
      
      create table p.child (
        id serial primary key,
        parent_id integer,
        name text not null,
        constraint child_parent_fkey foreign key (parent_id)
          references p.parent (id)
      );
      insert into p.parent values(1, 'test');
      insert into p.child values(99, 1, 'test child');
    `,
    test: async ({ schema, pgClient }) => {
      const query = `
        mutation {
          updateParentById(
            input: {
              id: 1
              parentPatch: {
                childrenUsingId: {
                  create: [{
                    name: "test child 2"
                  }, {
                    name: "test child 3"
                  }]
                }
              }
            }
          ) {
            parent {
              id
              name
              childrenByParentId {
                nodes {
                  id
                  parentId
                  name
                }
              }
            }
          }
        }
      `;
      expect(schema).toMatchSnapshot();

      const result = await graphql(schema, query, null, { pgClient });
      expect(result).not.toHaveProperty('errors');

      const data = result.data.updateParentById.parent;
      expect(data.childrenByParentId.nodes).toHaveLength(3);
      data.childrenByParentId.nodes.map(n => expect(n.parentId).toBe(data.id));
    },
  }),
);

test(
  'deleteOthers removes other records',
  withSchema({
    setup: `
      create table p.parent (
        id serial primary key,
        name text not null
      );
      
      create table p.child (
        id serial primary key,
        parent_id integer,
        name text not null,
        constraint child_parent_fkey foreign key (parent_id)
          references p.parent (id)
      );
      insert into p.parent values(1, 'test');
      insert into p.child values(99, 1, 'test child');
    `,
    test: async ({ schema, pgClient }) => {
      const query = `
        mutation {
          updateParentById(
            input: {
              id: 1
              parentPatch: {
                childrenUsingId: {
                  deleteOthers: true
                  create: [{
                    name: "test child 2"
                  }, {
                    name: "test child 3"
                  }]
                }
              }
            }
          ) {
            parent {
              id
              name
              childrenByParentId {
                nodes {
                  id
                  parentId
                  name
                }
              }
            }
          }
        }
      `;
      expect(schema).toMatchSnapshot();

      const result = await graphql(schema, query, null, { pgClient });
      expect(result).not.toHaveProperty('errors');

      const data = result.data.updateParentById.parent;
      expect(data.childrenByParentId.nodes).toHaveLength(2);
      data.childrenByParentId.nodes.map(n => expect(n.parentId).toBe(data.id));
    },
  }),
);

test(
  'deleteOthers is not available when no primary key on the foreign relation',
  withSchema({
    setup: `
      create table p.parent (
        id serial primary key,
        name text not null
      );
      
      create table p.child (
        id integer,
        parent_id integer,
        name text not null,
        constraint child_parent_fkey foreign key (parent_id)
          references p.parent (id)
      );
      insert into p.parent values(1, 'test');
      insert into p.child values(99, 1, 'test child');
    `,
    test: async ({ schema, pgClient }) => {
      const query = `
        mutation {
          updateParentById(
            input: {
              id: 1
              parentPatch: {
                childrenUsingId: {
                  deleteOthers: true
                  create: [{
                    id: 1
                    name: "test child 2"
                  }, {
                    id: 2
                    name: "test child 3"
                  }]
                }
              }
            }
          ) {
            parent {
              id
              name
              childrenByParentId {
                nodes {
                  id
                  parentId
                  name
                }
              }
            }
          }
        }
      `;
      expect(schema).toMatchSnapshot();

      const result = await graphql(schema, query, null, { pgClient });
      expect(result).toHaveProperty('errors');
      expect(result.errors[0].message).toMatch(/"deleteOthers" is not defined/);
    },
  }),
);

test(
  'forward nested mutation with nested update',
  withSchema({
    setup: `
      create table p.parent (
        id serial primary key,
        name text not null
      );
      
      create table p.child (
        id serial primary key,
        parent_id integer,
        name text not null,
        constraint child_parent_fkey foreign key (parent_id)
          references p.parent (id)
      );

      insert into p.parent values(1, 'test parent');
      insert into p.child values(1, 1, 'test child');
    `,
    test: async ({ schema, pgClient }) => {
      const query = `
        mutation {
          updateParentById(
            input: {
              id: 1
              parentPatch: {
                childrenUsingId: {
                  updateById: {
                    id: 1
                    childPatch: {
                      name: "renamed child"
                    }
                  }
                }
              }
            }
          ) {
            parent {
              id
              name
              childrenByParentId {
                nodes {
                  id
                  parentId
                  name
                }
              }
            }
          }
        }
      `;
      expect(schema).toMatchSnapshot();

      const result = await graphql(schema, query, null, { pgClient });
      expect(result).not.toHaveProperty('errors');

      const data = result.data.updateParentById.parent;
      expect(data.childrenByParentId.nodes).toHaveLength(1);
      data.childrenByParentId.nodes.map(n => expect(n.parentId).toBe(data.id));
      expect(data.childrenByParentId.nodes[0].name).toEqual('renamed child');
    },
  }),
);

test(
  'reverse nested mutation with nested update',
  withSchema({
    setup: `
      create table p.parent (
        id serial primary key,
        name text not null
      );
      
      create table p.child (
        id serial primary key,
        parent_id integer,
        name text not null,
        constraint child_parent_fkey foreign key (parent_id)
          references p.parent (id)
      );

      insert into p.parent values(1, 'test parent');
      insert into p.child values(1, 1, 'test child');
    `,
    test: async ({ schema, pgClient }) => {
      const query = `
        mutation {
          updateChildById(
            input: {
              id: 1
              childPatch: {
                parentToParentId: {
                  updateById: {
                    id: 1
                    parentPatch: {
                      name: "renamed parent"
                    }
                  }
                }
              }
            }
          ) {
            child {
              id
              name
              parentByParentId {
                id
                name
              }
            }
          }
        }
      `;
      expect(schema).toMatchSnapshot();

      const result = await graphql(schema, query, null, { pgClient });
      expect(result).not.toHaveProperty('errors');

      const data = result.data.updateChildById.child;
      expect(data.parentByParentId).not.toBeNull();
      expect(data.parentByParentId.name).toEqual('renamed parent');
    },
  }),
);

// coming soon
/* test(
  'forward nested mutation with nested update does not accept updates to constraint keys',
  withSchema({
    setup: `
      create table p.parent (
        id serial primary key,
        name text not null
      );

      create table p.child (
        id serial primary key,
        parent_id integer,
        name text not null,
        constraint child_parent_fkey foreign key (parent_id)
          references p.parent (id)
      );

      insert into p.parent values(1, 'test parent');
      insert into p.child values(1, 1, 'test child');
    `,
    test: async ({ schema, pgClient }) => {
      const query = `
        mutation {
          updateParentById(
            input: {
              id: 1
              parentPatch: {
                childrenUsingId: {
                  updateById: {
                    id: 1
                    childPatch: {
                      parentId: 7
                      name: "renamed child"
                    }
                  }
                }
              }
            }
          ) {
            parent {
              id
              name
              childrenByParentId {
                nodes {
                  id
                  parentId
                  name
                }
              }
            }
          }
        }
      `;
      expect(schema).toMatchSnapshot();

      const result = await graphql(schema, query, null, { pgClient });
      expect(result).toHaveProperty('errors');
      expect(result.errors[0].message).toMatch(/"parentId" is not defined/);
    },
  }),
);
*/
