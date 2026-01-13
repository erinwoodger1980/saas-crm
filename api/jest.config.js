/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.mjs$': 'babel-jest',
  },
  // Jest ignores node_modules transforms by default. pdfjs-dist v4 ships ESM (.mjs)
  // which must be transformed for this (CJS) Jest setup.
  transformIgnorePatterns: ['/node_modules/(?!.*pdfjs-dist)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^ml/(.*)$': '<rootDir>/src/ml/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.test.json',
      diagnostics: false,
      isolatedModules: true,
    },
  },
};