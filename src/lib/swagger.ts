
import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Kaburlu News Platform API',
    version: '1.0.0',
    description: 'REST API for Kaburlu platform, covering Superadmin, Language Admin, News Desk, Citizen Reporter, Categories & Category Translations.',
  },
  servers: [
    {
      url: 'https://3000-firebase-kaburlu-1756890240371.cluster-edb2jv34dnhjisxuq5m7l37ccy.cloudworkstations.dev',
      description: 'Development server on Cloud Workstations',
    },
    {
      url: 'https://app.kaburlumedia.com/v1',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Roles' },
    { name: 'Languages' },
    { name: 'States' },
    { name: 'Categories' },
    { name: 'Articles' },
    { name: 'Likes' },
    { name: 'Comments' },
    { name: 'Locations' },
    { name: 'Translate' },
    { name: 'Profiles' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Location: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          code: { type: 'string' },
          type: { type: 'string', enum: ['country', 'state', 'district', 'assembly', 'mandal', 'village'] },
          level: { type: 'integer' },
          stateId: { type: 'string' },
          parentId: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateLocationDto: {
        type: 'object',
        required: ['name', 'code', 'type', 'level', 'stateId'],
        properties: {
          name: { type: 'string', example: 'Adilabad' },
          code: { type: 'string', example: 'ADL' },
          type: { type: 'string', enum: ['country', 'state', 'district', 'assembly', 'mandal', 'village'], example: 'district' },
          level: { type: 'integer', example: 1 },
          stateId: { type: 'string', example: 'clxys930c0000vc11h2g5g4g3' },
          parentId: { type: 'string', nullable: true, example: null },
        },
      },
      UpdateLocationDto: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Adilabad' },
          code: { type: 'string', example: 'ADL' },
          type: { type: 'string', enum: ['country', 'state', 'district', 'assembly', 'mandal', 'village'], example: 'district' },
          level: { type: 'integer', example: 1 },
          stateId: { type: 'string', example: 'clxys930c0000vc11h2g5g4g3' },
          parentId: { type: 'string', nullable: true, example: null },
        },
      },
      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          dob: { type: 'string', format: 'date-time', nullable: true },
          maritalStatus: { type: 'string', nullable: true },
          emergencyContactNumber: { type: 'string', nullable: true },
          address: { type: 'object', nullable: true, properties: {} },
          stateId: { type: 'string', nullable: true },
          districtId: { type: 'string', nullable: true },
          assemblyId: { type: 'string', nullable: true },
          mandalId: { type: 'string', nullable: true },
          villageId: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserProfileDto: {
        type: 'object',
        properties: {
          dob: { type: 'string', description: 'Date of birth in dd-mm-yyyy or dd/mm/yyyy format.', example: '29-05-1992' },
          maritalStatus: { type: 'string', description: 'Marital status of the user.', example: 'Single' },
          emergencyContactNumber: { type: 'string', description: 'Emergency contact phone number.', example: '+19876543210' },
          address: { type: 'object', description: 'A structured address object.', example: { street: "123 Main St", city: "Anytown" } },
          stateId: { type: 'string', description: 'The ID of the user\'s state.', example: 'clx...' },
          districtId: { type: 'string', description: 'The ID of the user\'s district.', example: 'clx...' },
          assemblyId: { type: 'string', description: 'The ID of the user\'s assembly constituency.', example: 'clx...' },
          mandalId: { type: 'string', description: 'The ID of the user\'s mandal.', example: 'clx...' },
          villageId: { type: 'string', description: 'The ID of the user\'s village.', example: 'clx...' },
        },
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
          data: { type: 'object' },
        },
      },
      PaginationResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'integer', example: 100 },
                  page: { type: 'integer', example: 1 },
                  limit: { type: 'integer', example: 10 },
                },
              },
            },
          },
        ],
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/api/**/*.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
