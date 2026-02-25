import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/stories/**/*.stories.tsx"],
  framework: "@storybook/react-vite",
  addons: ["@storybook/addon-essentials"],
};

export default config;
