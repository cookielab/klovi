import type { Meta, StoryObj } from "@storybook/react";
import { CodeBox } from "../components/CodeBox/CodeBox.tsx";

const meta: Meta<typeof CodeBox> = {
  title: "Components/CodeBox",
  component: CodeBox,
};

export default meta;

type Story = StoryObj<typeof CodeBox>;

export const TypeScript: Story = {
  args: {
    language: "typescript",
    children: `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const result = greet("World");
console.log(result);`,
  },
};

export const ShortSnippet: Story = {
  args: {
    language: "bash",
    children: "bun run dev",
  },
};

export const NoLanguage: Story = {
  args: {
    children: "Plain text content without language specified",
  },
};

export const WithLineNumbers: Story = {
  args: {
    language: "css",
    showLineNumbers: true,
    children: `:root {
  --color: #333;
}`,
  },
};
