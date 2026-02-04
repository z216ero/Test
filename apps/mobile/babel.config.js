const isTestEnv = () =>
  process.env.BABEL_ENV === 'test' || process.env.NODE_ENV === 'test';

const moduleResolverPlugin = [
  'module-resolver',
  {
    root: ['./'],
    alias: {
      '@app': './src/app',
      '@api': './src/api',
      '@auth': './src/auth',
      '@config': './src/config',
      '@generated': './src/generated',
      '@i18n': './src/i18n',
      '@notifications': './src/notifications',
      '@query': './src/query',
      '@shared': './src/shared',
      '@ui': './src/ui',
      '@utils': './src/utils',
      '@userRole': './src/app/utils/userRole',
    },
  },
];

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: isTestEnv()
    ? [moduleResolverPlugin]
    : [
        moduleResolverPlugin,
        [
          '@tamagui/babel-plugin',
          {
            config: './tamagui.config.cjs',
            components: ['tamagui'],
          },
        ],
      ],
};
