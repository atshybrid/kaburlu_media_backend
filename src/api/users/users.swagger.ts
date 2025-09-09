export const userSwagger = {
  paths: {
    '/api/users': {
      get: {
        summary: 'Get all users',
        tags: ['Users'],
        responses: {
          '200': { description: 'A list of users' },
          '500': { description: 'Internal server error' },
        },
      },
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
                  name: { type: 'string', example: 'John Doe' },
                  roleId: { type: 'string', example: 'cmfbu2d9c0000f1h6g3d4e5f6' },
                  mobileNumber: { type: 'string', example: '1234567890' },
                  mpin: { type: 'string', example: '1234' },
                  email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
                },
                required: ['name', 'roleId', 'mobileNumber'],
              },
              example: {
                name: 'John Doe',
                roleId: 'cmfbu2d9c0000f1h6g3d4e5f6',
                mobileNumber: '1234567890',
                mpin: '1234',
                email: 'john.doe@example.com',
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
    },
    '/api/users/{id}': {
      get: {
        summary: 'Get a single user by ID',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'The ID of the user to retrieve.',
            schema: {
              type: 'string',
              example: 'cmfc46d9c000sf1jif354shvh',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse',
                },
                example: {
                  success: true,
                  message: 'User retrieved successfully',
                  data: {
                    id: 'cmfc46d9c000sf1jif354shvh',
                    name: 'John Doe',
                    email: 'john.doe@example.com',
                    mobileNumber: '1234567890',
                    status: 'ACTIVE',
                    roleId: 'cmfbu2d9c0000f1h6g3d4e5f6',
                    languageId: 'cmfc46d9c000sf1jif354shvh',
                    createdAt: '2025-09-09T05:32:34.849Z',
                    updatedAt: '2025-09-09T05:32:34.849Z',
                  },
                },
              },
            },
          },
          '404': { description: 'User not found' },
          '500': { description: 'Internal server error' },
        },
      },
      put: {
        summary: 'Update an existing user',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'The ID of the user to update.',
            schema: {
              type: 'string',
              example: 'cmfc89k010001f10r8rbyhs83',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  roleId: { type: 'string' },
                  languageId: { type: 'string' },
                  stateId: { type: 'string' },
                  status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
                  isVerified: { type: 'boolean' },
                },
              },
              example: {
                roleId: 'cmfc46akq0005f1ji86fzesbv',
                languageId: 'en',
                stateId: '',
                status: 'ACTIVE',
                isVerified: true,
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
        summary: 'Delete a user by ID',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'The user ID',
            schema: {
              type: 'string',
              example: 'cmfc46d9c000sf1jif354shvh',
            },
          },
        ],
        responses: {
          '204': { description: 'User deleted successfully' },
          '404': { description: 'User not found' },
        },
      },
    },
  },
};
