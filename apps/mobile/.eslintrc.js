module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['babel.config.js', '.eslintrc.js'],
      parserOptions: {
        requireConfigFile: false,
        sourceType: 'script',
      },
    },
    {
      files: ['index.js'],
      parserOptions: {
        requireConfigFile: false,
        sourceType: 'module',
      },
    },
  ],
};
