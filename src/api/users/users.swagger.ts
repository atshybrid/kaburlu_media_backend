
export const userSwagger = {
  paths: {
    '/api/users': {
      post: {
        summary: 'Create a new user',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  roleId: { type: 'string' },
                  mobileNumber: { type: 'string' },
                  mpin: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                },
                required: ['name', 'roleId', 'mobileNumber'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'User created successfully' },
          '400': { description: 'Invalid input' },
          '500': { description: 'Internal server error' },
        },
      },
      get: {
        summary: 'Get all users',
        tags: ['Users'],
        parameters: [
          {
            name: 'role',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'languageId',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': { description: 'Users retrieved successfully' },
          '500': { description: 'Internal server error' },
        },
      },
    },
    '/api/users/{id}': {
      get: {
        summary: 'Get a user by ID',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'User retrieved successfully' },
          '404': { description: 'User not found' },
          '500': { description: 'Internal server error' },
        },
      },
      put: {
        summary: 'Update a user',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  roleId: { type: 'string' },
                  languageId: { type: 'string' },
                  stateId: { type: 'string' },
                  status: { type: 'string' },
                  isVerified: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'User updated successfully' },
          '400': { description: 'Invalid input' },
          '404': { description: 'User not found' },
          '500': { description: 'Internal server error' },
        },
      },
      delete: {
        summary: 'Delete a user',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '204': { description: 'User deleted successfully' },
          '404': { description: 'User not found' },
          '500': { description: 'Internal server error' },
        },
      },
    },
  },
};
