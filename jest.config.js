module.exports = {
  testTimeout: 30000,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      // tsconfig: 'tsconfig.json',
      isolatedModules: true,
    }],
  },
};
