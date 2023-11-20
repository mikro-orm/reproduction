module.exports = {
  testTimeout: 30000,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      // tsconfig: 'tsconfig.json',
      isolatedModules: true,
    }],
  },
  "globalSetup": "<rootDir>/globalSetup.ts",
  "globalTeardown": "<rootDir>/globalTeardown.ts"
};
