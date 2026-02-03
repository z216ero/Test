const isTestEnv = () =>
  process.env.BABEL_ENV === 'test' || process.env.NODE_ENV === 'test';

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: isTestEnv()
    ? []
    : [
        [
          '@tamagui/babel-plugin',
          {
            config: './tamagui.config.cjs',
            components: ['tamagui'],
          },
        ],
      ],
};
