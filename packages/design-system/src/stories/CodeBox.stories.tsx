import type { Story, StoryDefault } from "@ladle/react";
import type { ComponentProps } from "react";
import { CodeBox } from "../components/CodeBox/CodeBox";

type CodeBoxProps = ComponentProps<typeof CodeBox>;

const argTypes = {
	language: {
		control: { type: "text" as const },
	},
	showLineNumbers: {
		control: { type: "boolean" as const },
	},
	children: {
		control: { type: "text" as const },
	},
};

export const TypeScript: Story<CodeBoxProps> = (props) => <CodeBox {...props} />;
TypeScript.args = {
	language: "typescript",
	children: `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const result = greet("World");
console.log(result);`,
};
TypeScript.argTypes = argTypes;

export const ShortSnippet: Story<CodeBoxProps> = (props) => <CodeBox {...props} />;
ShortSnippet.args = {
	language: "bash",
	children: "bun run dev",
};
ShortSnippet.argTypes = argTypes;

export const NoLanguage: Story<CodeBoxProps> = (props) => <CodeBox {...props} />;
NoLanguage.args = {
	children: "Plain text content without language specified",
};
NoLanguage.argTypes = argTypes;

export const WithLineNumbers: Story<CodeBoxProps> = (props) => <CodeBox {...props} />;
WithLineNumbers.args = {
	language: "css",
	showLineNumbers: true,
	children: `:root {
  --color: #333;
}`,
};
WithLineNumbers.argTypes = argTypes;

export default { title: "Components/CodeBox" } satisfies StoryDefault<CodeBoxProps>;
