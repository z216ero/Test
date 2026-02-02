module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      '@tamagui/babel-plugin',
      {
        config: './tamagui.config.ts',
        components: ['tamagui'],
      },
    ],
  ],
};
